-- عمودُ الإشعارات (الجزء ١ من الدفعة الثانية، 2026-10-19) — منقولٌ من الصحابة.
-- الإشعارُ خبرٌ عن أمرٍ وقع؛ أمّا طوابيرُ العمل فتُحسب عند العرض ولا تُخزَّن هنا.

-- ① مخطّطٌ غير مكشوف لـPostgREST: ما فيه لا يُستدعى من العميل.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ② الجدول: لمن · ماذا وقع · رابطُه · متى قُرئ.
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write'
  )),
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  body          text check (body is null or char_length(body) <= 400),
  -- مسارٌ داخليّ فقط: إشعارٌ يقود خارج المنصّة بابُ تصيّد.
  link          text check (link is null or link ~ '^/[A-Za-z0-9/_?=&-]*$'),
  source_table  text,
  source_id     uuid,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_expiry_idx on public.notifications (created_at);

alter table public.notifications enable row level security;

-- قراءةٌ لصاحبه وحده، ولا سياسةَ كتابةٍ إطلاقاً.
-- (Supabase تمنح anon وauthenticated كلَّ الحقوق افتراضياً على كل جدولٍ جديد؛ تُسحب أولاً ثم تُمنح القراءة.)
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_read on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

comment on table public.notifications is
  'إشعاراتُ الأحداث المنقضية. تكتبها مُشغّلاتٌ عبر private.notify، ويقرؤها صاحبُها وحده، وتُحذف بعد ثلاثة أشهر.';

-- ③ البابُ الوحيد للكتابة.
create or replace function private.notify(
  p_recipient uuid, p_kind text, p_title text, p_body text,
  p_link text, p_source_table text, p_source_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- بلا مستلمٍ لا إشعار (وإلا أسقط القيدُ العمليةَ الأصلية)، ولا يُشعَر أحدٌ بفعله هو.
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;

  insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
  values (p_recipient, p_kind, p_title, nullif(btrim(coalesce(p_body, '')), ''), p_link, p_source_table, p_source_id);

  -- التقليمُ بعد الإدراج وبدفعةٍ محدودة: ما مضى عليه ثلاثة أشهر.
  delete from public.notifications
   where id in (select id from public.notifications
                 where created_at < now() - interval '3 months'
                 order by created_at limit 200);
end;
$$;
revoke all on function private.notify(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

-- ④ التعليمُ بالقراءة — دالّةٌ لا سياسةُ update (لا يعيد صاحبُ الإشعار كتابةَ نصّه).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    return 0;
  end if;
  update public.notifications
     set read_at = now()
   where recipient_id = v_uid and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ⑤ الوصولُ الفوريّ (Realtime يحترم RLS).
alter publication supabase_realtime add table public.notifications;

-- ⑥ الفحصُ الذاتيّ.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass) then
    raise exception 'notifications: RLS غير مفعّل';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd <> 'SELECT') then
    raise exception 'notifications: سياسة كتابةٍ غير مقصودة';
  end if;
  if not has_table_privilege('authenticated', 'public.notifications', 'select') then
    raise exception 'notifications: منحُ القراءة ناقص';
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'insert')
     or has_table_privilege('authenticated', 'public.notifications', 'update')
     or has_table_privilege('authenticated', 'public.notifications', 'delete') then
    raise exception 'notifications: منحُ كتابةٍ غير مقصود';
  end if;
  if has_function_privilege('authenticated', 'private.notify(uuid, text, text, text, text, text, uuid)', 'execute') then
    raise exception 'private.notify: مكشوفةٌ للعميل';
  end if;
  if not has_function_privilege('authenticated', 'public.mark_notifications_read(uuid[])', 'execute') then
    raise exception 'mark_notifications_read: منحُ التنفيذ ناقص';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    raise exception 'notifications: ليست في supabase_realtime';
  end if;
end $$;
