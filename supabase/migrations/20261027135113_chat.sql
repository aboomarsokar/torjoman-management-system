-- المحادثاتُ الفورية (طلب المستخدم 2026-10-27): محادثةٌ فرديةٌ بين اثنين يحقّ لهما التراسل، وثلاثُ مجموعاتٍ ثابتة
-- (الإدارة · معلّمو البنين · معلّمات البنات) يتجدّد أعضاؤها وحدهم، و«متصلٌ الآن / آخرُ ظهور».
-- من يحادث من (متناظر): المديرُ الإداريّ الجميعَ؛ والفنيُّ الإدارةَ وكادرَ البنين؛ والمديرةُ الإدارةَ وكادرَ البنات؛
-- ومشرفُ المشروع الإدارةَ؛ والمشرفُ والمختبِرُ الإدارةَ (المديرَ الإداريَّ ومديرَ قسمه) ومعلّمي حلقاتهما؛
-- والمعلّمُ المديرَ الإداريَّ ومديرَ قسمه ومشرفَ حلقته ومختبِرَها. المحادثةُ خاصّةٌ بأعضائها — لا يقرؤها غيرُهم.
-- الكتابةُ بدوالّ RPC وحدها؛ والقراءةُ بـRLS (والبثُّ اللحظيّ يحترمها).

create table public.chat_conversations (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('direct', 'group')),
  group_key        text unique check (group_key in ('management', 'male_teachers', 'female_teachers')),
  direct_key       text unique,
  title            text check (title is null or char_length(title) <= 80),
  last_message     text,
  last_message_at  timestamptz,
  last_sender_id   uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint chat_conversations_group check ((kind = 'group') = (group_key is not null)),
  constraint chat_conversations_direct check ((kind = 'direct') = (direct_key is not null))
);

create table public.chat_members (
  conversation_id  uuid not null references public.chat_conversations(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index chat_members_profile_idx on public.chat_members (profile_id);

create table public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id        uuid references public.profiles(id) on delete set null,
  body             text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at desc);

create table public.user_presence (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at  timestamptz not null default now()
);

-- ─── من يحادث من ───────────────────────────────────────────────────────────────
create or replace function private.chat_contact_ids(p_me uuid)
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  with me as (
    select id, role::text as role, gender::text as gender
      from public.profiles where id = p_me and status = 'active' and role <> 'student'
  ),
  staff as (
    select id, role::text as role, gender::text as gender
      from public.profiles where status = 'active' and role <> 'student' and id <> p_me
  ),
  section_manager as (
    select case me.gender when 'male' then 'technical_manager' when 'female' then 'women_admin' end as role from me
  )
  -- المديرُ الإداريّ: الجميع
  select s.id from staff s, me where me.role = 'admin_manager'
  union
  -- الإدارةُ فيما بينها
  select s.id from staff s, me
   where me.role in ('project_supervisor', 'admin_manager', 'technical_manager', 'women_admin')
     and s.role in ('project_supervisor', 'admin_manager', 'technical_manager', 'women_admin')
  union
  -- مديرُ القسم وكادرُه (البنين للفنيّ، والبنات للمديرة)
  select s.id from staff s, me
   where (me.role = 'technical_manager' and s.gender = 'male' and s.role in ('field_supervisor', 'examiner', 'teacher'))
      or (me.role = 'women_admin' and s.gender = 'female' and s.role in ('field_supervisor', 'examiner', 'teacher'))
  union
  -- الكادرُ: المديرُ الإداريّ ومديرُ قسمه
  select s.id from staff s, me, section_manager sm
   where me.role in ('field_supervisor', 'examiner', 'teacher')
     and (s.role = 'admin_manager' or s.role = sm.role)
  union
  -- المشرفُ والمختبِرُ ومعلّمو حلقاتهما (في الاتجاهين)
  select h.teacher_id from public.halaqat h, me
   where h.status = 'active' and h.teacher_id is not null
     and ((me.role = 'field_supervisor' and h.supervisor_id = me.id) or (me.role = 'examiner' and h.examiner_id = me.id))
  union
  select x.id from public.halaqat h, me
   cross join lateral (values (h.supervisor_id), (h.examiner_id)) as x(id)
   where me.role = 'teacher' and h.status = 'active' and h.teacher_id = me.id and x.id is not null
$$;
revoke all on function private.chat_contact_ids(uuid) from public, anon, authenticated;

create or replace function private.can_chat(p_me uuid, p_other uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from private.chat_contact_ids(p_me) c where c = p_other)
     and exists (select 1 from public.profiles p where p.id = p_other and p.status = 'active')
$$;
revoke all on function private.can_chat(uuid, uuid) from public, anon, authenticated;

-- معرّفاتٌ لسياسات RLS (مصفوفةٌ واحدةٌ للطلب لا نداءٌ لكلّ صفّ)
create or replace function public.my_chat_conversation_ids()
returns uuid[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(conversation_id), '{}') from public.chat_members where profile_id = (select auth.uid())
$$;
revoke all on function public.my_chat_conversation_ids() from public, anon;
grant execute on function public.my_chat_conversation_ids() to authenticated;

create or replace function public.my_chat_contact_ids()
returns uuid[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(c), '{}') from private.chat_contact_ids((select auth.uid())) c
$$;
revoke all on function public.my_chat_contact_ids() from public, anon;
grant execute on function public.my_chat_contact_ids() to authenticated;

-- ─── RLS: القراءةُ لأعضاء المحادثة، ولا كتابةَ مباشرة ─────────────────────────────
alter table public.chat_conversations enable row level security;
create policy chat_conversations_select on public.chat_conversations for select to authenticated
  using (id = any ((select public.my_chat_conversation_ids())::uuid[]));
grant select on public.chat_conversations to authenticated;
select private.guard_table_for_impersonation('public.chat_conversations');

alter table public.chat_members enable row level security;
create policy chat_members_select on public.chat_members for select to authenticated
  using (conversation_id = any ((select public.my_chat_conversation_ids())::uuid[]));
grant select on public.chat_members to authenticated;
select private.guard_table_for_impersonation('public.chat_members');

alter table public.chat_messages enable row level security;
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (conversation_id = any ((select public.my_chat_conversation_ids())::uuid[]));
grant select on public.chat_messages to authenticated;
select private.guard_table_for_impersonation('public.chat_messages');

alter table public.user_presence enable row level security;
create policy user_presence_select on public.user_presence for select to authenticated
  using (profile_id = (select auth.uid()) or profile_id = any ((select public.my_chat_contact_ids())::uuid[]));
grant select on public.user_presence to authenticated;
select private.guard_table_for_impersonation('public.user_presence');

-- ─── المجموعاتُ الثابتة ─────────────────────────────────────────────────────────
insert into public.chat_conversations (kind, group_key, title) values
  ('group', 'management', 'الإدارة'),
  ('group', 'male_teachers', 'معلمو البنين'),
  ('group', 'female_teachers', 'معلمات البنات');

create or replace function private.sync_chat_groups()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.assert_session_writable();
  with wanted as (
    select c.id as conversation_id, p.id as profile_id
      from public.chat_conversations c
      join public.profiles p on p.status = 'active' and (
           (c.group_key = 'management' and p.role in ('project_supervisor', 'admin_manager', 'technical_manager', 'women_admin'))
        or (c.group_key = 'male_teachers' and (p.role in ('admin_manager', 'technical_manager') or (p.role = 'teacher' and p.gender = 'male')))
        or (c.group_key = 'female_teachers' and (p.role in ('admin_manager', 'women_admin') or (p.role = 'teacher' and p.gender = 'female'))))
     where c.kind = 'group'
  ),
  removed as (
    delete from public.chat_members m
     using public.chat_conversations c
     where c.id = m.conversation_id and c.kind = 'group'
       and not exists (select 1 from wanted w where w.conversation_id = m.conversation_id and w.profile_id = m.profile_id)
  )
  insert into public.chat_members (conversation_id, profile_id)
  select conversation_id, profile_id from wanted
  on conflict do nothing;
end;
$$;
revoke all on function private.sync_chat_groups() from public, anon, authenticated;

create or replace function private.sync_chat_groups_trigger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.sync_chat_groups();
  return null;
end;
$$;
revoke all on function private.sync_chat_groups_trigger() from public, anon, authenticated;

create trigger profiles_sync_chat_groups
  after insert or delete or update of role, status, gender on public.profiles
  for each statement execute function private.sync_chat_groups_trigger();

select private.sync_chat_groups();

-- ─── الكتابة ────────────────────────────────────────────────────────────────────
-- يبدأ محادثةً فرديةً (أو يعيد القائمة) مع من يحقّ له محادثتُه
create or replace function public.start_direct_chat(p_other uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  perform private.assert_session_writable();
  if v_me is null or p_other is null or p_other = v_me or not private.can_chat(v_me, p_other) then
    raise exception 'لا تستطيع محادثة هذا الشخص.' using errcode = '42501';
  end if;
  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);
  insert into public.chat_conversations (kind, direct_key) values ('direct', v_key)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into v_id;
  insert into public.chat_members (conversation_id, profile_id)
  values (v_id, v_me), (v_id, p_other)
  on conflict do nothing;
  return v_id;
end;
$$;
revoke all on function public.start_direct_chat(uuid) from public, anon;
grant execute on function public.start_direct_chat(uuid) to authenticated;

create or replace function public.send_chat_message(p_conversation uuid, p_body text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_kind text;
  v_other uuid;
  v_id uuid;
  v_at timestamptz := now();
begin
  perform private.assert_session_writable();
  if not exists (select 1 from public.chat_members where conversation_id = p_conversation and profile_id = v_me)
     or not exists (select 1 from public.profiles where id = v_me and status = 'active') then
    raise exception 'لست عضواً في هذه المحادثة.' using errcode = '42501';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 2000 then
    raise exception 'الرسالة فارغةٌ أو أطول من 2000 حرف.' using errcode = '22023';
  end if;
  select kind into v_kind from public.chat_conversations where id = p_conversation;
  if v_kind = 'direct' then
    select profile_id into v_other from public.chat_members where conversation_id = p_conversation and profile_id <> v_me limit 1;
    if v_other is null or not private.can_chat(v_me, v_other) then
      raise exception 'لم تعد تستطيع مراسلة هذا الشخص.' using errcode = '42501';
    end if;
  end if;
  insert into public.chat_messages (conversation_id, sender_id, body, created_at)
  values (p_conversation, v_me, v_body, v_at) returning id into v_id;
  update public.chat_conversations
     set last_message = left(v_body, 200), last_message_at = v_at, last_sender_id = v_me
   where id = p_conversation;
  update public.chat_members set last_read_at = v_at
   where conversation_id = p_conversation and profile_id = v_me;
  return v_id;
end;
$$;
revoke all on function public.send_chat_message(uuid, text) from public, anon;
grant execute on function public.send_chat_message(uuid, text) to authenticated;

-- القراءةُ والحضور: في نيابة القراءة لا أثرَ (لا تُعلَّم رسائلُ الهدف مقروءةً ولا يظهر متصلاً)
create or replace function public.mark_chat_read(p_conversation uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.session_is_read_only() then
    return;
  end if;
  update public.chat_members set last_read_at = now()
   where conversation_id = p_conversation and profile_id = auth.uid();
end;
$$;
revoke all on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

create or replace function public.touch_presence()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or private.session_is_read_only() or private.is_impersonating() then
    return;
  end if;
  insert into public.user_presence (profile_id, last_seen_at) values (auth.uid(), now())
  on conflict (profile_id) do update set last_seen_at = excluded.last_seen_at;
end;
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- ─── القراءةُ المجمّعة ─────────────────────────────────────────────────────────
-- محادثاتي بآخر رسالةٍ وعددِ غير المقروء وبيانات الطرف الآخر (لا يقرأ المعلّمُ ملفاتِ غيره بـRLS)
create or replace function public.my_chats()
returns table (
  id uuid, kind text, group_key text, title text,
  other_id uuid, other_name text, other_role text, other_gender text, other_avatar text, other_last_seen timestamptz,
  last_message text, last_message_at timestamptz, last_sender_id uuid, unread integer, members integer
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.kind, c.group_key, c.title,
         o.id, o.full_name, o.role::text, o.gender::text, o.avatar_url, pr.last_seen_at,
         c.last_message, c.last_message_at, c.last_sender_id,
         (select count(*)::int from public.chat_messages m
           where m.conversation_id = c.id and m.created_at > me.last_read_at and m.sender_id is distinct from me.profile_id),
         (select count(*)::int from public.chat_members x where x.conversation_id = c.id)
    from public.chat_members me
    join public.chat_conversations c on c.id = me.conversation_id
    left join lateral (
      select p.* from public.chat_members x join public.profiles p on p.id = x.profile_id
       where c.kind = 'direct' and x.conversation_id = c.id and x.profile_id <> me.profile_id limit 1
    ) o on true
    left join public.user_presence pr on pr.profile_id = o.id
   where me.profile_id = auth.uid()
     -- الفرديةُ تظهر في القائمة بعد أوّل رسالة (ومن بدأها يفتحها بمعرّفها)
     and (c.kind = 'group' or c.last_message_at is not null)
   order by coalesce(c.last_message_at, c.created_at) desc
$$;
revoke all on function public.my_chats() from public, anon;
grant execute on function public.my_chats() to authenticated;

-- من أستطيع محادثته (لزرّ «محادثة جديدة») بحالته
create or replace function public.chat_contacts()
returns table (id uuid, full_name text, role text, gender text, avatar_url text, last_seen_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.role::text, p.gender::text, p.avatar_url, pr.last_seen_at
    from private.chat_contact_ids(auth.uid()) c
    join public.profiles p on p.id = c
    left join public.user_presence pr on pr.profile_id = p.id
   order by p.full_name
$$;
revoke all on function public.chat_contacts() from public, anon;
grant execute on function public.chat_contacts() to authenticated;

-- أعضاءُ محادثةٍ أنا فيها: الاسمُ والدورُ وآخرُ قراءة (لأسماء المرسِلين في المجموعة وعلامة «قُرئت»)
create or replace function public.chat_conversation_members(p_conversation uuid)
returns table (id uuid, full_name text, role text, gender text, avatar_url text, last_read_at timestamptz, last_seen_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.role::text, p.gender::text, p.avatar_url, m.last_read_at, pr.last_seen_at
    from public.chat_members m
    join public.profiles p on p.id = m.profile_id
    left join public.user_presence pr on pr.profile_id = p.id
   where m.conversation_id = p_conversation
     and exists (select 1 from public.chat_members me where me.conversation_id = p_conversation and me.profile_id = auth.uid())
   order by p.full_name
$$;
revoke all on function public.chat_conversation_members(uuid) from public, anon;
grant execute on function public.chat_conversation_members(uuid) to authenticated;

-- البثُّ اللحظيّ (يحترم سياساتِ القراءة أعلاه)
alter publication supabase_realtime add table public.chat_messages, public.chat_members, public.chat_conversations;
