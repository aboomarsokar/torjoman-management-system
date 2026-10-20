-- ============================================================
-- الدخول بالنيابة (الجزء ٥) — اللبّ. منقولٌ من الصحابة بتعديلات (الخطة 2026-10-20-impersonation.md).
-- الوسمُ على الجلسة (session_id في JWT) لا على الحساب: الموظفُ يعمل في جلسته بلا أثر.
-- الحارسُ يسأل «هل هذه الجلسةُ نيابة؟» لا «هل ما زالت مفتوحة؟» — فالصفُّ لا يُحذف أبداً
-- والجلسةُ المنسيّة تبقى قراءةً فقط إلى أن تُبطَل: يفشل مغلقاً.
-- ============================================================

create table public.impersonation_sessions (
  session_id        uuid primary key,
  -- المعرّفان يقبلان الفراغ ومعهما الاسمان نصّاً: السجلُّ يبقى بعد حذف الحساب (لا cascade).
  actor_profile_id  uuid references auth.users (id) on delete set null,
  target_profile_id uuid references auth.users (id) on delete set null,
  actor_name        text not null check (btrim(actor_name) <> ''),
  target_name       text not null check (btrim(target_name) <> ''),
  actor_role        public.user_role not null check (actor_role in ('admin_manager', 'technical_manager')),
  started_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  ended_at          timestamptz,
  ended_reason      text check (ended_reason in ('manual', 'signed_out', 'superseded', 'expired', 'actor_inactive')),
  write_until       timestamptz,
  return_to         text check (return_to is null or return_to ~ '^/[A-Za-z0-9/_?=&-]*$'),
  constraint impersonation_window check (expires_at > started_at and expires_at <= started_at + interval '30 minutes'),
  constraint impersonation_write_within check (write_until is null or write_until <= expires_at),
  constraint impersonation_end_stamp check ((ended_at is null) = (ended_reason is null)),
  -- `<>` لا `is distinct from`: بعد حذف الحسابين (null, null) يبقى القيدُ صادقاً.
  constraint impersonation_not_self check (actor_profile_id <> target_profile_id)
);
create index impersonation_sessions_actor on public.impersonation_sessions (actor_profile_id, started_at desc);
create index impersonation_sessions_target on public.impersonation_sessions (target_profile_id);
create index impersonation_sessions_open on public.impersonation_sessions (expires_at) where ended_at is null;

-- RLS بلا سياسةٍ واحدة — مقصود: لا يبلغه العميلُ قراءةً ولا كتابة؛ يكتبه الخادمُ وتقرؤه الدوالّ definer.
alter table public.impersonation_sessions enable row level security;
-- service_role في السحب أيضاً: الامتيازاتُ الافتراضيّة في public تمنحه arwdDxtm على كلّ جدولٍ جديد
-- (أمسكه الفحصُ الذاتيّ في التجربة الملغاة)، والمنحُ بعدُ هو القائمةُ البيضاء.
revoke all on public.impersonation_sessions from public, anon, authenticated, service_role;
-- ولا delete لأحد: حذفُ الصفّ يمحو السجلّ **ويقلب جلسةً حيّةً جلسةً كاملةَ الكتابة**.
grant select, insert, update on public.impersonation_sessions to service_role;

-- سجلُّ الكتابة في وضع التعديل — الصفُّ كاملاً قبلُ وبعدُ، وفتحُ النافذة وإغلاقُها.
create table public.impersonation_writes (
  id                bigint generated always as identity primary key,
  session_id        uuid not null,
  actor_profile_id  uuid,
  target_profile_id uuid,
  occurred_at       timestamptz not null default now(),
  op                text not null check (op in ('INSERT', 'UPDATE', 'DELETE', 'write_mode_on', 'write_mode_off')),
  table_name        text,
  old_row           jsonb,
  new_row           jsonb,
  route             text
);
create index impersonation_writes_session on public.impersonation_writes (session_id, occurred_at);
alter table public.impersonation_writes enable row level security;
revoke all on public.impersonation_writes from public, anon, authenticated, service_role;
revoke all on sequence public.impersonation_writes_id_seq from public, anon, authenticated, service_role;
grant select on public.impersonation_writes to authenticated;
-- لا update/delete لأحد: سجلُّ تدقيقٍ يُعدَّل ليس سجلاً.
grant select, insert on public.impersonation_writes to service_role;
grant usage, select on sequence public.impersonation_writes_id_seq to service_role;
create policy impersonation_writes_select on public.impersonation_writes for select to authenticated
  using (public.is_admin_manager());

-- ═══ الحارسان ═══
-- nullif يحرس الفراغ: رمزٌ بلا session_id (service_role، postgres) ← «لا».
create or replace function private.is_impersonating()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.impersonation_sessions s
    where s.session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
  );
$$;

-- لا تنظر في ended_at ولا expires_at: الانتهاءُ لا يفتح الكتابة أبداً.
create or replace function private.session_is_read_only()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.impersonation_sessions s
    where s.session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and (s.write_until is null or s.write_until <= now())
  );
$$;

-- ما تناديه السياساتُ التقييديّة: ترمي برسالةٍ تقول إنّه منعٌ مقصودٌ لا عطب (النصُّ = IMPERSONATION_READ_ONLY_MESSAGE).
create or replace function private.assert_session_writable()
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.session_is_read_only() then
    raise exception 'أنت تتصفّح بالنيابة — قراءةٌ فقط، فلا يُحفظ شيءٌ باسم غيرك. فعّل وضعَ التعديل من الشريط إن لزم.'
      using errcode = '42501';
  end if;
  return true;
end;
$$;

revoke all on function private.is_impersonating() from public, anon, authenticated;
revoke all on function private.session_is_read_only() from public, anon, authenticated;
revoke all on function private.assert_session_writable() from public, anon, authenticated;
-- في السياسات وفي WHEN — فلكلّ دورٍ يكتب: authenticated (PostgREST) وservice_role (الخادم).
grant execute on function private.is_impersonating() to authenticated, service_role;
grant execute on function private.session_is_read_only() to authenticated, service_role;
grant execute on function private.assert_session_writable() to authenticated, service_role;

-- ═══ مشغّلُ السجلّ (يُعلَّق على الجداول في Task 2) ═══
create or replace function private.log_impersonation_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  s record;
begin
  select session_id, actor_profile_id, target_profile_id into s
  from public.impersonation_sessions
  where session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid;

  insert into public.impersonation_writes (session_id, actor_profile_id, target_profile_id, op, table_name, old_row, new_row)
  values (s.session_id, s.actor_profile_id, s.target_profile_id, tg_op, tg_table_schema || '.' || tg_table_name,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return null;
end;
$$;
revoke all on function private.log_impersonation_write() from public, anon, authenticated;

-- ═══ مُنتِجا الإشعار (عقد العمود الفقريّ ب، ج) ═══
-- يكتب الصفَّ service_role فـauth.uid() فارغ ← شرطُ «لا يُشعَر أحدٌ بفعله» في private.notify لا يُسقطه.
-- ولا WHEN بدالّة على المشغّل (يُقيَّم بصلاحية service_role) — المنطقُ في البدن.
create or replace function private.notify_impersonation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_gender text;
  v_label text;
begin
  select p.gender::text into v_gender from public.profiles p where p.id = new.actor_profile_id;
  v_label := case
    when new.actor_role = 'admin_manager' then 'المدير الإداري'
    when v_gender = 'female' then 'المديرة الفنية'
    else 'المدير الفني' end;

  if tg_op = 'INSERT' then
    perform private.notify(
      new.target_profile_id, 'impersonation_started',
      'اطّلع ' || v_label || ' على حسابك',
      'فتح ' || new.actor_name || ' شاشتَك قراءةً فقط في '
        || to_char(new.started_at at time zone 'Asia/Gaza', 'DD-MM-YYYY HH24:MI')
        || ' (بتوقيت غزة) لنصف ساعةٍ على الأكثر. لم يُغيَّر شيء.',
      null, 'impersonation_sessions', new.session_id);
  elsif new.write_until is not null and new.write_until > now()
        and (old.write_until is null or old.write_until <= now()) then
    perform private.notify(
      new.target_profile_id, 'impersonation_write',
      'فتح ' || v_label || ' التعديلَ في حسابك',
      'يستطيع ' || new.actor_name || ' التعديلَ باسمك حتى '
        || to_char(new.write_until at time zone 'Asia/Gaza', 'HH24:MI')
        || ' (بتوقيت غزة)، وكلُّ تعديلٍ فيها مسجَّلٌ بصورته قبلُ وبعدُ.',
      null, 'impersonation_sessions', new.session_id);
  end if;
  return null;
end;
$$;
revoke all on function private.notify_impersonation() from public, anon, authenticated;
create trigger impersonation_notify_started after insert on public.impersonation_sessions
  for each row execute function private.notify_impersonation();
create trigger impersonation_notify_write after update of write_until on public.impersonation_sessions
  for each row execute function private.notify_impersonation();

-- ═══ إبطالُ جلسات النيابة بمعرّفها — لا revoke_sessions (تحذف كلَّ جلسات المستخدم) ═══
create or replace function private.end_impersonation_sessions(p_session_ids uuid[])
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_removed integer;
begin
  if p_session_ids is null or cardinality(p_session_ids) = 0 then
    return 0;
  end if;
  -- لا تُبطَل إلّا جلسةٌ مسجَّلةٌ نيابةً: وإلّا صارت بابَ إخراجٍ لأيّ مستخدم.
  delete from auth.sessions s
   where s.id = any (p_session_ids)
     and exists (select 1 from public.impersonation_sessions i where i.session_id = s.id);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
revoke all on function private.end_impersonation_sessions(uuid[]) from public, anon, authenticated;
grant execute on function private.end_impersonation_sessions(uuid[]) to service_role;

-- وجهٌ في public لأنّ PostgREST لا يبلغ private (§0) — لـservice_role وحده، والحارسُ في المفوَّض إليه.
create or replace function public.end_impersonation_sessions(p_session_ids uuid[])
returns integer language sql security definer set search_path = ''
as $$ select private.end_impersonation_sessions(p_session_ids); $$;
revoke all on function public.end_impersonation_sessions(uuid[]) from public, anon, authenticated;
grant execute on function public.end_impersonation_sessions(uuid[]) to service_role;

-- ═══ بياناتُ الدخول خارج RLS: GoTrue يكتب auth.users بدوره هو ═══
-- جلسةُ النيابة تملك auth.updateUser({ password | email }) — والمدير الفني لا يملك إعادة التعيين أصلاً.
-- فما دامت للهدف جلسةُ نيابةٍ حيّة في auth.sessions يُرفض تغييرُ بيانات دخوله (من أيّ جلسة — يفشل مغلقاً).
-- reset-password يرفع must_change_password أوّلاً ← profiles_revoke_sessions يُبطل جلسةَ النيابة ← فيمرّ.
-- WHEN بمقارنة أعمدةٍ فقط (لا دالّة) — فلا منحَ يلزم supabase_auth_admin.
create or replace function private.guard_impersonated_credentials()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.impersonation_sessions i
    join auth.sessions s on s.id = i.session_id
    where i.target_profile_id = new.id
  ) then
    raise exception 'لا تُغيَّر بياناتُ الدخول وللحساب جلسةُ نيابةٍ قائمة.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_impersonated_credentials() from public, anon, authenticated;
create trigger impersonation_credentials_guard
  before update of encrypted_password, email, email_change, phone on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password
        or old.email is distinct from new.email
        or old.email_change is distinct from new.email_change
        or old.phone is distinct from new.phone)
  execute function private.guard_impersonated_credentials();

-- ═══ فحصٌ ذاتيّ ═══
do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'impersonation_sessions') <> 0 then
    raise exception 'impersonation_sessions يجب أن يكون بلا سياسة';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.impersonation_sessions'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.impersonation_writes'::regclass) then
    raise exception 'RLS مطفأة على جدول نيابة';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'impersonation_sessions'
               and grantee in ('anon', 'authenticated')) then
    raise exception 'impersonation_sessions يبلغه العميل';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name in ('impersonation_sessions', 'impersonation_writes')
               and privilege_type in ('DELETE', 'TRUNCATE') and grantee in ('anon', 'authenticated', 'service_role')) then
    raise exception 'حذفٌ ممنوحٌ على جدول نيابة';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'impersonation_writes'
               and grantee in ('anon', 'authenticated', 'service_role')
               and (privilege_type = 'UPDATE' or (grantee <> 'service_role' and privilege_type <> 'SELECT'))) then
    raise exception 'impersonation_writes: منحٌ يتجاوز القراءة والإدراج';
  end if;
  if not has_function_privilege('authenticated', 'private.assert_session_writable()', 'execute')
     or not has_function_privilege('service_role', 'private.assert_session_writable()', 'execute')
     or not has_function_privilege('service_role', 'private.is_impersonating()', 'execute')
     or not has_function_privilege('authenticated', 'private.is_impersonating()', 'execute') then
    raise exception 'منحُ الحارسين ناقص — ستسقط الكتابة';
  end if;
  if has_function_privilege('authenticated', 'public.end_impersonation_sessions(uuid[])', 'execute')
     or has_function_privilege('anon', 'public.end_impersonation_sessions(uuid[])', 'execute')
     or not has_function_privilege('service_role', 'public.end_impersonation_sessions(uuid[])', 'execute') then
    raise exception 'end_impersonation_sessions: المنحُ خاطئ';
  end if;
  if (select private.is_impersonating()) is not false or (select private.session_is_read_only()) is not false then
    raise exception 'الحارسان لا يُرجعان «لا» بلا جلسة';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'impersonation_credentials_guard'
                 and tgrelid = 'auth.users'::regclass) then
    raise exception 'حارسُ بيانات الدخول لم يُنشأ';
  end if;
end $$;
