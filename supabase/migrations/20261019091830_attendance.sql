-- الحضورُ اليوميّ بالاستثناء (الجزء ٢ من الدفعة الثانية، 2026-10-19).
-- يومٌ مفتوحٌ للحلقة = حضورٌ للجميع، والغياباتُ وحدها تُسجَّل فيه (excused / unexcused).
-- «اليوم» تاريخُ غزة. لا يُكتب يومٌ لم يأتِ، ولا في شهرٍ رصدُه معتمَد.

create table public.attendance_days (
  halaqa_id uuid not null references public.halaqat (id) on delete cascade,
  day date not null,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (halaqa_id, day)
);
comment on table public.attendance_days is 'أيامُ الحلقة المفتوحة: وجودُ الصفّ = يومٌ دراسيّ حضره كلُّ الملتحقين إلا المذكورين في attendance_absences.';

create table public.attendance_absences (
  halaqa_id uuid not null,
  day date not null,
  student_id uuid not null references public.students (id) on delete cascade,
  kind text not null check (kind in ('excused', 'unexcused')),
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (day, student_id),
  foreign key (halaqa_id, day) references public.attendance_days (halaqa_id, day) on delete cascade
);
comment on table public.attendance_absences is 'غياباتُ الأيام المفتوحة: kind = excused (بعذر) أو unexcused (بلا عذر).';
create index attendance_absences_student_day_idx on public.attendance_absences (student_id, day);

-- «اليوم» بتوقيت غزة (لا بتوقيت الخادم).
create or replace function private.attendance_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Gaza')::date;
$$;

-- هل رصدُ شهر ذلك اليوم لتلك الحلقة معتمَد؟
create or replace function private.attendance_month_approved(p_halaqa uuid, p_day date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.monthly_reports r
     where r.halaqa_id = p_halaqa
       and r.report_month = extract(month from p_day)::int
       and r.report_year = extract(year from p_day)::int
       and r.status = 'approved');
$$;

create or replace function private.guard_attendance_days()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.day > private.attendance_today() then
    raise exception 'لا يُسجَّل يومٌ لم يأتِ';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and private.attendance_month_approved(old.halaqa_id, old.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and private.attendance_month_approved(new.halaqa_id, new.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.guard_attendance_absences()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_halaqa uuid;
  v_enrolled date;
begin
  if tg_op in ('UPDATE', 'DELETE') and private.attendance_month_approved(old.halaqa_id, old.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if private.attendance_month_approved(new.halaqa_id, new.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  if tg_op = 'INSERT' or new.student_id is distinct from old.student_id
     or new.halaqa_id is distinct from old.halaqa_id or new.day is distinct from old.day then
    select s.halaqa_id, s.enrollment_date into v_halaqa, v_enrolled
      from public.students s where s.id = new.student_id;
    if v_halaqa is distinct from new.halaqa_id then
      raise exception 'الطالب ليس في هذه الحلقة';
    end if;
    if v_enrolled is not null and v_enrolled > new.day then
      raise exception 'الطالب لم يكن ملتحقاً في ذلك اليوم';
    end if;
  end if;
  return new;
end;
$$;

create trigger attendance_days_guard before insert or update or delete on public.attendance_days
  for each row execute function private.guard_attendance_days();
create trigger attendance_absences_guard before insert or update or delete on public.attendance_absences
  for each row execute function private.guard_attendance_absences();

alter table public.attendance_days enable row level security;
alter table public.attendance_absences enable row level security;

revoke all on public.attendance_days, public.attendance_absences from public, anon, authenticated;
grant select, insert, update, delete on public.attendance_days, public.attendance_absences to authenticated;
revoke all on function private.attendance_today(), private.attendance_month_approved(uuid, date),
  private.guard_attendance_days(), private.guard_attendance_absences() from public, anon, authenticated;
grant execute on function private.attendance_today() to authenticated, service_role;

create policy attendance_days_read on public.attendance_days for select to authenticated
  using (public.can_view_halaqa(halaqa_id) or halaqa_id = public.my_halaqa_id());
create policy attendance_days_insert on public.attendance_days for insert to authenticated
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));
create policy attendance_days_update on public.attendance_days for update to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));
create policy attendance_days_delete on public.attendance_days for delete to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));

create policy attendance_absences_read on public.attendance_absences for select to authenticated
  using (public.can_view_halaqa(halaqa_id) or student_id = public.my_student_id());
create policy attendance_absences_insert on public.attendance_absences for insert to authenticated
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));
create policy attendance_absences_update on public.attendance_absences for update to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));
create policy attendance_absences_delete on public.attendance_absences for delete to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id));

-- الفحصُ الذاتيّ: يرفع استثناءً عند أيّ خلل فتُلغى الهجرة كلّها.
do $$
declare
  t text;
begin
  foreach t in array array['attendance_days', 'attendance_absences'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception '%: RLS غير مفعّل', t;
    end if;
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t and cmd = 'SELECT') <> 1 then
      raise exception '%: سياسة القراءة ليست واحدة', t;
    end if;
    if exists (select 1 from information_schema.role_table_grants
                where table_schema = 'public' and table_name = t and grantee in ('anon', 'PUBLIC')) then
      raise exception '%: منحٌ لـanon/PUBLIC', t;
    end if;
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 4 then
      raise exception '%: السياسات ليست 4', t;
    end if;
  end loop;
  if (select count(*) from pg_trigger where not tgisinternal
        and tgname in ('attendance_days_guard', 'attendance_absences_guard')) <> 2 then
    raise exception 'الحارسان غير موجودين';
  end if;
  if private.attendance_today() is null then raise exception 'attendance_today ترد null'; end if;
end $$;
