-- منظومةُ مقابلات المرشّحين (طلب المستخدم 2026-10-30): تسجيلٌ عامٌّ بلا حساب ← فرزٌ ← دعوةٌ لمقابلةٍ بموعدٍ ولجنة ←
-- تقييمُ كلّ عضو لجنةٍ من حسابه (عشرة بنودٍ كلٌّ من 5، والأوزانُ في الواجهة) ← قرارٌ (مقبول · احتياط · مرفوض) ← تحويلٌ إلى معلّم.
-- النطاق: المديرُ الإداريّ للقسمين، والمديرُ الفنيّ للبنين، والمديرةُ الإدارية للبنات، ومشرفُ المشروع يقرأ؛ وعضوُ اللجنة يرى
-- من أُسند إليه وحده.

create type public.candidate_status as enum ('new', 'invited', 'interviewed', 'accepted', 'reserve', 'rejected', 'hired');

create table public.candidates (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (char_length(btrim(full_name)) between 3 and 120),
  national_id      text not null check (national_id ~ '^[0-9]{9}$'),
  phone            text not null check (phone ~ '^05[0-9]{8}$'),
  gender           public.gender_type not null,
  birth_date       date,
  residence        text check (residence is null or char_length(residence) <= 120),
  nearest_mosque   text check (nearest_mosque is null or char_length(nearest_mosque) <= 120),
  quran_parts      smallint check (quran_parts is null or quran_parts between 0 and 30),
  tajweed_level    text check (tajweed_level is null or char_length(tajweed_level) <= 60),
  education        text check (education is null or char_length(education) <= 120),
  experience       text check (experience is null or char_length(experience) <= 1000),
  about            text check (about is null or char_length(about) <= 1000),
  status           public.candidate_status not null default 'new',
  interview_at     timestamptz,
  interview_place  text check (interview_place is null or char_length(interview_place) <= 200),
  decision_note    text check (decision_note is null or char_length(decision_note) <= 1000),
  status_changed_by uuid references public.profiles(id) on delete set null,
  status_changed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint candidates_national_id_unique unique (national_id)
);
create index candidates_status_idx on public.candidates (status, gender);
create index candidates_interview_idx on public.candidates (interview_at) where interview_at is not null;

create table public.candidate_committee (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  assigned_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (candidate_id, profile_id)
);
create index candidate_committee_profile_idx on public.candidate_committee (profile_id);

create table public.candidate_evaluations (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  scores       smallint[] not null
               check (array_length(scores, 1) = 10 and 0 <= all (scores) and 5 >= all (scores)),
  notes        text check (notes is null or char_length(notes) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (candidate_id, evaluator_id)
);
create index candidate_evaluations_evaluator_idx on public.candidate_evaluations (evaluator_id);

-- ── النطاق ──────────────────────────────────────────────────

-- يرى مرشّحي هذا الجنس: الإداريُّ ومشرفُ المشروع الكلَّ، والفنيُّ البنين، والمديرةُ البنات
create or replace function public.can_view_candidates_of(p_gender public.gender_type)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select public.current_user_role()) in ('admin_manager', 'project_supervisor')
    or ((select public.current_user_role()) = 'technical_manager' and p_gender = 'male')
    or ((select public.current_user_role()) = 'women_admin' and p_gender = 'female'), false)
$$;
revoke all on function public.can_view_candidates_of(public.gender_type) from public, anon;
grant execute on function public.can_view_candidates_of(public.gender_type) to authenticated;

-- يدير مرشّحي هذا الجنس (فرزٌ وجدولةٌ ولجنةٌ وقرار): بلا مشرف المشروع
create or replace function public.can_manage_candidates_of(p_gender public.gender_type)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select public.current_user_role()) = 'admin_manager'
    or ((select public.current_user_role()) = 'technical_manager' and p_gender = 'male')
    or ((select public.current_user_role()) = 'women_admin' and p_gender = 'female'), false)
$$;
revoke all on function public.can_manage_candidates_of(public.gender_type) from public, anon;
grant execute on function public.can_manage_candidates_of(public.gender_type) to authenticated;

-- المرشّحون المسندون إلى المستخدم عضواً في لجنتهم
create or replace function public.my_candidate_ids()
returns uuid[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(candidate_id), '{}') from public.candidate_committee where profile_id = (select auth.uid())
$$;
revoke all on function public.my_candidate_ids() from public, anon;
grant execute on function public.my_candidate_ids() to authenticated;

alter table public.candidates enable row level security;
create policy candidates_select on public.candidates for select to authenticated
  using ((select public.can_view_candidates_of(gender)) or id = any ((select public.my_candidate_ids())::uuid[]));
create policy candidates_insert on public.candidates for insert to authenticated
  with check ((select public.can_manage_candidates_of(gender)));
create policy candidates_update on public.candidates for update to authenticated
  using ((select public.can_manage_candidates_of(gender))) with check ((select public.can_manage_candidates_of(gender)));
create policy candidates_delete on public.candidates for delete to authenticated using ((select public.is_admin_manager()));
grant select, insert, update, delete on public.candidates to authenticated;
select private.guard_table_for_impersonation('public.candidates');

alter table public.candidate_committee enable row level security;
create policy candidate_committee_select on public.candidate_committee for select to authenticated
  using (profile_id = (select auth.uid())
         or exists (select 1 from public.candidates c where c.id = candidate_id and public.can_view_candidates_of(c.gender)));
create policy candidate_committee_insert on public.candidate_committee for insert to authenticated
  with check (exists (select 1 from public.candidates c where c.id = candidate_id and public.can_manage_candidates_of(c.gender)));
create policy candidate_committee_delete on public.candidate_committee for delete to authenticated
  using (exists (select 1 from public.candidates c where c.id = candidate_id and public.can_manage_candidates_of(c.gender)));
grant select, insert, delete on public.candidate_committee to authenticated;
select private.guard_table_for_impersonation('public.candidate_committee');

alter table public.candidate_evaluations enable row level security;
create policy candidate_evaluations_select on public.candidate_evaluations for select to authenticated
  using (evaluator_id = (select auth.uid())
         or exists (select 1 from public.candidates c where c.id = candidate_id and public.can_view_candidates_of(c.gender)));
-- المقيِّمُ يكتب تقييمَه هو: مديرٌ في نطاق المرشّح، أو عضوٌ في لجنته
create policy candidate_evaluations_insert on public.candidate_evaluations for insert to authenticated
  with check (evaluator_id = (select auth.uid())
              and (candidate_id = any ((select public.my_candidate_ids())::uuid[])
                   or exists (select 1 from public.candidates c where c.id = candidate_id and public.can_manage_candidates_of(c.gender))));
create policy candidate_evaluations_update on public.candidate_evaluations for update to authenticated
  using (evaluator_id = (select auth.uid()))
  with check (evaluator_id = (select auth.uid()));
create policy candidate_evaluations_delete on public.candidate_evaluations for delete to authenticated
  using (evaluator_id = (select auth.uid()) or (select public.is_admin_manager()));
grant select, insert, update, delete on public.candidate_evaluations to authenticated;
select private.guard_table_for_impersonation('public.candidate_evaluations');

-- ── الحرّاس ──────────────────────────────────────────────────

-- تغيّرُ الحالة يُسجَّل (مَن ومتى)، ويُلمس updated_at
create or replace function private.candidate_touch()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_by := auth.uid();
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.candidate_touch() from public, anon, authenticated;
create trigger candidates_touch before update on public.candidates
  for each row execute function private.candidate_touch();

-- عضوُ اللجنة من العاملين النشطين (لا طالب)
create or replace function private.candidate_committee_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.profile_id and p.role::text <> 'student' and p.status::text = 'active') then
    raise exception 'عضوُ اللجنة من العاملين النشطين في المنصّة.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.candidate_committee_guard() from public, anon, authenticated;
create trigger candidate_committee_guard before insert on public.candidate_committee
  for each row execute function private.candidate_committee_guard();

-- أوّلُ تقييمٍ لمدعوٍّ ينقله إلى «قوبل»
create or replace function private.candidate_evaluation_touch()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    update public.candidates set status = 'interviewed' where id = new.candidate_id and status = 'invited';
  end if;
  return new;
end;
$$;
revoke all on function private.candidate_evaluation_touch() from public, anon, authenticated;
create trigger candidate_evaluations_touch before insert or update on public.candidate_evaluations
  for each row execute function private.candidate_evaluation_touch();

-- ── التسجيلُ العامّ والاستعلام (بلا حساب) ─────────────────────

create or replace function public.register_candidate(
  p_full_name text, p_national_id text, p_phone text, p_gender public.gender_type,
  p_birth_date date default null, p_residence text default null, p_nearest_mosque text default null,
  p_quran_parts smallint default null, p_tajweed_level text default null, p_education text default null,
  p_experience text default null, p_about text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.assert_session_writable();
  -- كبحٌ بسيطٌ للإغراق الآليّ: لا أكثر من 40 تسجيلاً في الدقيقة للمنصّة كلّها
  if (select count(*) from public.candidates where created_at > now() - interval '1 minute') >= 40 then
    raise exception 'ضغطٌ على التسجيل الآن — حاول بعد دقيقة.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.candidates where national_id = btrim(p_national_id)) then
    raise exception 'سبق التسجيلُ برقم الهوية هذا — استعلم عن حالة طلبك.' using errcode = '23505';
  end if;
  insert into public.candidates (full_name, national_id, phone, gender, birth_date, residence, nearest_mosque,
                                 quran_parts, tajweed_level, education, experience, about)
  values (btrim(p_full_name), btrim(p_national_id), btrim(p_phone), p_gender, p_birth_date,
          nullif(btrim(coalesce(p_residence, '')), ''), nullif(btrim(coalesce(p_nearest_mosque, '')), ''),
          p_quran_parts, nullif(btrim(coalesce(p_tajweed_level, '')), ''), nullif(btrim(coalesce(p_education, '')), ''),
          nullif(btrim(coalesce(p_experience, '')), ''), nullif(btrim(coalesce(p_about, '')), ''));
end;
$$;
revoke all on function public.register_candidate(text, text, text, public.gender_type, date, text, text, smallint, text, text, text, text) from public;
grant execute on function public.register_candidate(text, text, text, public.gender_type, date, text, text, smallint, text, text, text, text) to anon, authenticated;

-- الاستعلامُ عن الطلب: الهويةُ والجوالُ معاً (فلا يُستعلم عن غيرك برقم هويته وحده)
create or replace function public.candidate_status_lookup(p_national_id text, p_phone text)
returns table (full_name text, status public.candidate_status, interview_at timestamptz, interview_place text)
language sql stable security definer
set search_path = ''
as $$
  select c.full_name, c.status,
         case when c.status = 'invited' then c.interview_at end,
         case when c.status = 'invited' then c.interview_place end
    from public.candidates c
   where c.national_id = btrim(p_national_id) and c.phone = btrim(p_phone)
$$;
revoke all on function public.candidate_status_lookup(text, text) from public;
grant execute on function public.candidate_status_lookup(text, text) to anon, authenticated;

-- الزائرُ لا يقرأ الجداول ولا يكتبها (المنحُ الافتراضيّ يمنحه) — يسجّل ويستعلم بالدالّتين وحدهما
revoke all on public.candidates, public.candidate_committee, public.candidate_evaluations from anon;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'candidate_evaluations_touch')
     or not exists (select 1 from pg_trigger where tgname = 'candidate_committee_guard') then
    raise exception 'حرّاس المرشّحين ناقصة';
  end if;
  if not has_function_privilege('anon', 'public.register_candidate(text, text, text, public.gender_type, date, text, text, smallint, text, text, text, text)', 'execute') then
    raise exception 'التسجيلُ العامّ غيرُ متاحٍ للزائر';
  end if;
  if has_table_privilege('anon', 'public.candidates', 'select') then
    raise exception 'الزائرُ يقرأ جدولَ المرشّحين';
  end if;
end $$;
