-- ============================================================
-- إشعارُ المعلّم حين يُعاد إليه كشفُ الحوافز (موافقةُ المستخدم 2026-10-20).
-- الإعادةُ بـreturn_statement (هجرة 20261019141105) تكتب returned_at؛ مُشغِّلٌ بعد التحديث يُشعر معلّمَ الحلقة
-- بخبرٍ واحدٍ لكلّ إعادة: العنوان، والشهرُ بالأرقام، وملاحظةُ المراجِع مقصوصة.
-- نوعٌ جديد statement_returned: القيدُ وقائمةُ private.notify وNOTIFICATION_KINDS معاً (عقد العمود الفقريّ «هـ»).
-- ============================================================

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned',
  'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded',
  'transport_paid',
  'impersonation_started', 'impersonation_write',
  'statement_returned'
));

create or replace function private.notify(
  p_recipient uuid, p_kind text, p_title text, p_body text,
  p_link text, p_source_table text, p_source_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- بلا مستلمٍ لا إشعار، ولا يُشعَر أحدٌ بفعله هو.
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;

  -- التحقّق نفسُه قيودُ الجدول، لكنّه هنا تحذيرٌ لا استثناء: القيدُ كان سيُسقط العمليةَ الأصلية.
  -- (قائمةُ الأنواع تطابق notifications_kind_check — تُحدَّث معه عند إضافة نوع.)
  if p_kind is null or p_kind not in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write',
    'statement_returned'
  ) then
    raise warning 'notify: نوعٌ غير معروف %', p_kind;
    return;
  end if;
  if p_link is not null and p_link !~ '^/[A-Za-z0-9/_?=&-]*$' then
    raise warning 'notify: رابطٌ غير مسموح %', p_link;
    return;
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise warning 'notify: عنوانٌ فارغ (النوع %)', p_kind;
    return;
  end if;

  begin
    insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
    values (p_recipient, p_kind, left(btrim(p_title), 120), left(nullif(btrim(coalesce(p_body, '')), ''), 400), p_link, p_source_table, p_source_id);

    -- التقليمُ بعد الإدراج وبدفعةٍ محدودة: ما مضى عليه ثلاثة أشهر، وما أقفله غيرُنا يُترك لدورةٍ لاحقة.
    delete from public.notifications
     where id in (select id from public.notifications
                   where created_at < now() - interval '3 months'
                   order by created_at limit 200
                   for update skip locked);
  exception when others then
    raise warning 'notify failed: %', sqlerrm;
  end;
end;
$$;
revoke all on function private.notify(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

-- المُنتِج: كلُّ إعادةٍ جديدة (returned_at تغيّر إلى قيمة) ← خبرٌ لمعلّم حلقة الكشف
create or replace function private.notify_statement_returned()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_teacher uuid;
  v_note text;
begin
  select h.teacher_id into v_teacher from public.halaqat h where h.id = new.halaqa_id;
  v_note := btrim(coalesce(new.return_note, ''));
  if char_length(v_note) > 300 then
    v_note := left(v_note, 299) || '…';
  end if;
  perform private.notify(
    v_teacher, 'statement_returned', 'أُعيد إليك كشف الحوافز للتعديل',
    'الشهر ' || lpad(new.statement_month::text, 2, '0') || '-' || new.statement_year
      || case when v_note <> '' then ' · ' || v_note else '' end,
    '/incentives', 'incentive_statements', new.id);
  return null;
end;
$$;
revoke all on function private.notify_statement_returned() from public, anon, authenticated;

drop trigger if exists incentive_statements_notify_returned on public.incentive_statements;
create trigger incentive_statements_notify_returned
  after update of returned_at on public.incentive_statements
  for each row
  when (new.returned_at is not null and new.returned_at is distinct from old.returned_at)
  execute function private.notify_statement_returned();

-- فحصٌ ذاتيّ
do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'notifications_kind_check')) not like '%statement_returned%' then
    raise exception 'قيدُ الأنواع لم يُحدَّث';
  end if;
  if pg_get_functiondef('private.notify(uuid, text, text, text, text, text, uuid)'::regprocedure) not like '%statement_returned%' then
    raise exception 'قائمةُ private.notify لم تُحدَّث';
  end if;
  if has_function_privilege('authenticated', 'private.notify(uuid, text, text, text, text, text, uuid)', 'execute')
     or has_function_privilege('anon', 'private.notify_statement_returned()', 'execute') then
    raise exception 'منحٌ زائد على دوالّ الإشعار';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'incentive_statements_notify_returned' and not tgisinternal) then
    raise exception 'مُشغِّلُ إشعار الإعادة مفقود';
  end if;
end $$;
