-- رسائلُ الإدارة للكادر (طلب المستخدم 2026-10-25) — تحلّ محلّ «إشعارات المعلّمين» (teacher_announcements، فارغٌ ولم يُنشر):
--   • الجمهورُ فئاتٌ (المعلّمون والمشرفون الميدانيون والمختبِرون) × قسمٌ (البنين/البنات/الكلّ)، أو شخصٌ بعينه.
--   • المرسِلون كلٌّ لقسمه: المديرُ الإداريّ للكلّ، والفنيُّ لكادر البنين، والمديرةُ الإدارية لكادر البنات.
--   • لكلّ مستلمٍ سطرٌ بوقت مشاهدته؛ يُسجَّل حين يفتح «رسائل الإدارة» — لا في النيابة (المديرُ يتصفّح بحساب غيره).

drop function if exists public.send_teacher_announcement(text, text, text, text);
drop table if exists public.teacher_announcements;

create table public.staff_messages (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  body        text check (body is null or char_length(body) <= 600),
  link        text check (link is null or link ~ '^/[A-Za-z0-9/_?=&-]*$'),
  roles       text[] check (roles is null or (cardinality(roles) > 0 and roles <@ array['teacher', 'field_supervisor', 'examiner'])),
  section     text check (section is null or section in ('all', 'male', 'female')),
  target_id   uuid references public.profiles(id) on delete cascade,
  recipients  integer not null default 0,
  sent_by     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- إمّا شخصٌ بعينه وإمّا مجموعة (فئاتٌ وقسم)
  constraint staff_messages_audience check (
    (target_id is not null and roles is null and section is null)
    or (target_id is null and roles is not null and section is not null))
);

create index staff_messages_created_idx on public.staff_messages (created_at desc);
create index staff_messages_target_idx on public.staff_messages (target_id);
create index staff_messages_sent_by_idx on public.staff_messages (sent_by);

create table public.staff_message_recipients (
  message_id    uuid not null references public.staff_messages(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  seen_at       timestamptz,
  primary key (message_id, recipient_id)
);

create index staff_message_recipients_recipient_idx on public.staff_message_recipients (recipient_id, seen_at);

alter table public.staff_messages enable row level security;
alter table public.staff_message_recipients enable row level security;

-- المستلمون: كلٌّ سطرَه، والإداريُّ ومشرفُ المشروع الكلَّ، والفنيُّ الذكورَ، والمديرةُ الإناث.
create policy staff_message_recipients_select on public.staff_message_recipients for select to authenticated
  using (
    recipient_id = (select auth.uid())
    or public.current_user_role() in ('admin_manager', 'project_supervisor')
    or (public.current_user_role() = 'technical_manager' and not private.is_female_profile(recipient_id))
    or (public.current_user_role() = 'women_admin' and private.is_female_profile(recipient_id))
  );

-- الرسائل: المستلمُ ما وصله، والمرسِلُ ما أرسل، ومَن فوقُ ما في نطاقه.
create policy staff_messages_select on public.staff_messages for select to authenticated
  using (
    sent_by = (select auth.uid())
    or public.current_user_role() in ('admin_manager', 'project_supervisor')
    or (public.current_user_role() = 'technical_manager'
        and ((target_id is null and section in ('all', 'male'))
          or (target_id is not null and not private.is_female_profile(target_id))))
    or (public.current_user_role() = 'women_admin'
        and ((target_id is null and section in ('all', 'female'))
          or (target_id is not null and private.is_female_profile(target_id))))
    or exists (select 1 from public.staff_message_recipients r
                where r.message_id = staff_messages.id and r.recipient_id = (select auth.uid()))
  );

-- الكتابةُ بالدالّتين وحدَهما (لا منحَ إدراجٍ ولا تحديث).
grant select on public.staff_messages, public.staff_message_recipients to authenticated;

select private.guard_table_for_impersonation('public.staff_messages');
select private.guard_table_for_impersonation('public.staff_message_recipients');

-- الإرسال: يحفظ الرسالةَ ومستلميها ويُشعرهم؛ ويُرجع عددَهم.
create or replace function public.send_staff_message(
  p_title text, p_body text, p_link text, p_roles text[], p_section text, p_target uuid
) returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_role text := public.current_user_role();
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_id uuid;
  v_n integer;
  t record;
begin
  perform private.assert_session_writable();

  if v_role not in ('admin_manager', 'technical_manager', 'women_admin') then
    raise exception 'لا صلاحية لإرسال الرسائل' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'العنوان مطلوب' using errcode = '22023';
  end if;

  if p_target is not null then
    select role::text as role, gender::text as gender, status into t from public.profiles where id = p_target;
    if t is null or t.status <> 'active' or t.role not in ('teacher', 'field_supervisor', 'examiner') then
      raise exception 'المستلمُ ليس من الكادر النشط' using errcode = '22023';
    end if;
    if (v_role = 'technical_manager' and t.gender = 'female') or (v_role = 'women_admin' and t.gender is distinct from 'female') then
      raise exception 'لا صلاحية للمراسلة خارج قسمك' using errcode = '42501';
    end if;
  else
    if p_roles is null or cardinality(p_roles) = 0 or not (p_roles <@ array['teacher', 'field_supervisor', 'examiner']) then
      raise exception 'اختر فئةً واحدةً على الأقلّ' using errcode = '22023';
    end if;
    if not (v_role = 'admin_manager'
            or (v_role = 'technical_manager' and p_section = 'male')
            or (v_role = 'women_admin' and p_section = 'female')) then
      raise exception 'لا صلاحية للمراسلة خارج قسمك' using errcode = '42501';
    end if;
  end if;

  insert into public.staff_messages (title, body, link, roles, section, target_id, sent_by)
  values (btrim(p_title), nullif(btrim(coalesce(p_body, '')), ''), v_link,
          case when p_target is null then p_roles end, case when p_target is null then p_section end, p_target, auth.uid())
  returning id into v_id;

  insert into public.staff_message_recipients (message_id, recipient_id)
  select v_id, p.id from public.profiles p
   where p.status = 'active'
     and p.id <> auth.uid()
     and (case when p_target is not null then p.id = p_target
               else p.role::text = any (p_roles) and (p_section = 'all' or p.gender::text = p_section) end);
  get diagnostics v_n = row_count;

  update public.staff_messages set recipients = v_n where id = v_id;

  perform private.notify(r.recipient_id, 'announcement', btrim(p_title), p_body, '/messages', 'staff_messages', v_id)
     from public.staff_message_recipients r where r.message_id = v_id;

  return v_n;
end;
$function$;

revoke all on function public.send_staff_message(text, text, text, text[], text, uuid) from public, anon;
grant execute on function public.send_staff_message(text, text, text, text[], text, uuid) to authenticated;

-- المشاهدة: المستلمُ نفسُه يفتح رسائله — والنيابةُ لا تُحتسب (لا تُسجَّل ولا تُرفض، كي تبقى الشاشةُ قابلةً للقراءة).
create or replace function public.mark_staff_messages_seen(p_ids uuid[])
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_n integer;
begin
  if private.is_impersonating() then
    return 0;
  end if;
  update public.staff_message_recipients
     set seen_at = now()
   where recipient_id = auth.uid() and seen_at is null and message_id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke all on function public.mark_staff_messages_seen(uuid[]) from public, anon;
grant execute on function public.mark_staff_messages_seen(uuid[]) to authenticated;
