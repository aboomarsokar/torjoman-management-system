-- ============================================================
-- كشف المواصلات (الجزء ٤): رحلاتُ المشرف الميداني والمختبِر، وتسديدُها بيد المدير الإداري.
-- مستقلٌّ عن الملفّ المالي (قرار المستخدم 2026-10-19). الإشعار transport_paid قائمٌ في القيد سلفاً.
-- ============================================================

-- مَن يُدخل رحلات (إضافةُ دورٍ سطرٌ واحد هنا وفي TRANSPORT_LOGGER_ROLES)
create or replace function private.can_log_transport()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_user_role()::text in ('field_supervisor', 'examiner'), false);
$$;
revoke all on function private.can_log_transport() from public, anon, authenticated;
grant execute on function private.can_log_transport() to authenticated, service_role;

create table public.transport_trips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_date date not null,
  description text not null check (btrim(description) <> '' and char_length(description) <= 200),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 10000),
  notes text check (notes is null or char_length(notes) <= 500),
  paid boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_paid_stamp check ((paid and paid_at is not null) or (not paid and paid_at is null and paid_by is null))
);
create index transport_trips_profile_date on public.transport_trips (profile_id, trip_date);
create index transport_trips_date on public.transport_trips (trip_date);

create trigger trg_transport_trips_updated_at before update on public.transport_trips
  for each row execute function public.set_updated_at();

alter table public.transport_trips enable row level security;
revoke all on public.transport_trips from public, anon, authenticated;
grant select, insert, update, delete on public.transport_trips to authenticated;

-- قراءة: صاحبُها، والمدير الإداري، ومشرف المشروع
create policy transport_select on public.transport_trips for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin_manager() or public.is_project_supervisor());

-- إدراج: من يُدخل رحلاتٍ لنفسه، غيرَ مسدَّدة؛ والمدير الإداري لأيّ موظفٍ يُدخل رحلات
create policy transport_insert on public.transport_trips for insert to authenticated
  with check (
    (private.can_log_transport() and profile_id = (select auth.uid()) and not paid)
    or public.is_admin_manager()
  );

-- تعديل/حذف: صاحبُها ما دامت غيرَ مسدَّدة؛ والمدير الإداري دائماً
create policy transport_update on public.transport_trips for update to authenticated
  using ((profile_id = (select auth.uid()) and not paid) or public.is_admin_manager())
  with check ((profile_id = (select auth.uid()) and not paid) or public.is_admin_manager());
create policy transport_delete on public.transport_trips for delete to authenticated
  using ((profile_id = (select auth.uid()) and not paid) or public.is_admin_manager());

-- حارس: غيرُ المدير الإداري لا يلمس التسديد ولا صاحبَ الرحلة؛ والتاريخُ لا يسبق اليوم بتوقيت غزة؛
-- وصاحبُ الرحلة ممّن يُدخلون رحلات (يحمي إدراجَ المدير الإداري لغيرهم).
create or replace function private.guard_transport_trip()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.trip_date > (now() at time zone 'Asia/Gaza')::date then
    raise exception 'لا تُسجَّل رحلةٌ بتاريخٍ لم يأتِ بعد.' using errcode = '23514';
  end if;
  if not public.is_admin_manager() then
    if tg_op = 'INSERT' and (new.paid or new.paid_at is not null or new.paid_by is not null) then
      raise exception 'التسديدُ للمدير الإداري وحده.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
         new.paid is distinct from old.paid or new.paid_at is distinct from old.paid_at
         or new.paid_by is distinct from old.paid_by or new.profile_id is distinct from old.profile_id) then
      raise exception 'التسديدُ وصاحبُ الرحلة للمدير الإداري وحده.' using errcode = '42501';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id) and not exists (
       select 1 from public.profiles p
       where p.id = new.profile_id and p.role::text in ('field_supervisor', 'examiner')) then
    raise exception 'صاحبُ الرحلة ليس مشرفاً ميدانياً ولا مختبِراً.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_transport_trip() from public, anon, authenticated;
create trigger transport_trips_guard before insert or update on public.transport_trips
  for each row execute function private.guard_transport_trip();

-- التسديد الجماعيّ: للمدير الإداري وحده؛ يضبط الحالة ومَن/متى، ويُشعر كلَّ صاحب رحلاتٍ بخبرٍ واحد
-- (العدد والمبلغ والشهر) عند التسديد فقط. يردّ عددَ الرحلات التي تغيّرت حالتُها.
create or replace function public.set_transport_paid(p_ids uuid[], p_paid boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
  r record;
begin
  if not public.is_admin_manager() then
    raise exception 'التسديدُ للمدير الإداري وحده.' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or p_paid is null then
    return 0;
  end if;

  create temporary table if not exists _transport_changed (id uuid, profile_id uuid, trip_date date, amount numeric) on commit drop;
  truncate _transport_changed;

  with changed as (
    update public.transport_trips t
       set paid = p_paid,
           paid_at = case when p_paid then now() else null end,
           paid_by = case when p_paid then (select auth.uid()) else null end
     where t.id = any (p_ids) and t.paid is distinct from p_paid
    returning t.id, t.profile_id, t.trip_date, t.amount
  )
  insert into _transport_changed select * from changed;
  get diagnostics v_count = row_count;

  if p_paid then
    for r in
      select c.profile_id,
             count(*) as n,
             sum(c.amount) as total,
             string_agg(distinct to_char(c.trip_date, 'MM-YYYY'), '، ' order by to_char(c.trip_date, 'MM-YYYY')) as months,
             min(c.trip_date) as first_day
        from _transport_changed c
       group by c.profile_id
    loop
      perform private.notify(
        r.profile_id, 'transport_paid', 'سُدّدت رحلاتُك',
        'عدد الرحلات: ' || r.n || ' · المبلغ: ' || to_char(r.total, 'FM999990.00') || ' ₪ · الشهر: ' || r.months,
        '/transport?y=' || extract(year from r.first_day)::int || '&m=' || extract(month from r.first_day)::int,
        'transport_trips', null);
    end loop;
  end if;
  return v_count;
end;
$$;
revoke all on function public.set_transport_paid(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.set_transport_paid(uuid[], boolean) to authenticated;

-- فحصٌ ذاتيّ
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.transport_trips'::regclass) then
    raise exception 'RLS غير مفعّل على transport_trips';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'transport_trips') <> 4 then
    raise exception 'سياساتُ transport_trips ليست أربعاً';
  end if;
  if has_table_privilege('anon', 'public.transport_trips', 'select') then
    raise exception 'anon يقرأ transport_trips';
  end if;
  if not has_function_privilege('authenticated', 'private.can_log_transport()', 'execute')
     or not has_function_privilege('service_role', 'private.can_log_transport()', 'execute') then
    raise exception 'can_log_transport: المنحُ ناقص';
  end if;
  if has_function_privilege('anon', 'public.set_transport_paid(uuid[], boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.set_transport_paid(uuid[], boolean)', 'execute') then
    raise exception 'set_transport_paid: المنحُ خاطئ';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'transport_trips_guard' and not tgisinternal) then
    raise exception 'حارسُ الرحلات مفقود';
  end if;
end $$;
