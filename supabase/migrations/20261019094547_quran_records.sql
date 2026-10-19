-- الرصدُ الشهريّ بالسورة والآية (الجزء ٢ من الدفعة الثانية، 2026-10-19).
-- سجلٌّ لكلّ طالبٍ في كلّ تقرير: من (سورة:آية) إلى (سورة:آية) بترتيب الحفظ (من الناس إلى الفاتحة)،
-- وصفحاتُ الحفظ والمراجعة، ومسارُ اعتمادٍ جديد: المشرفُ الميدانيّ للحلقة يعتمد (والمديران احتياطاً)،
-- والمديرُ الفنيّ يطّلع ولا يعتمد. `can_approve_in_halaqa` لا تُمسّ (يعتمد عليها الإسناد).
-- تنبيه: تغيّر سلوكُ صفحة التقارير القديمة الحيّة (reports_write / guard_report_status) بقرار المستخدم؛
-- والجدولان القديمان monthly_report_students/activities لا يُمسّان.

-- 0) معتمِدُ الرصد
create or replace function public.can_approve_report_in_halaqa(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.current_user_role() = 'admin_manager'
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')
      or (public.current_user_role() = 'field_supervisor' and h.supervisor_id = auth.uid())));
$$;
revoke all on function public.can_approve_report_in_halaqa(uuid) from public, anon;
grant execute on function public.can_approve_report_in_halaqa(uuid) to authenticated, service_role;

-- 1) الجدول
create table public.quran_records (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.monthly_reports (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  from_surah smallint references public.surahs (number),
  from_ayah smallint,
  to_surah smallint references public.surahs (number),
  to_ayah smallint,
  pages_memorized smallint not null default 0 check (pages_memorized between 0 and 604),
  pages_reviewed smallint check (pages_reviewed between 0 and 604),
  notes text check (notes is null or char_length(notes) <= 500),
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, student_id),
  constraint quran_records_positions_all_or_none check (
    (from_surah is null and from_ayah is null and to_surah is null and to_ayah is null)
    or (from_surah is not null and from_ayah is not null and to_surah is not null and to_ayah is not null)),
  constraint quran_records_pages_need_range check (from_surah is not null or pages_memorized = 0)
);
comment on table public.quran_records is 'رصدُ القرآن الشهريّ لكلّ طالب في تقرير: النطاقُ من/إلى بترتيب الحفظ (من الناس إلى الفاتحة) وصفحاتُ الحفظ والمراجعة.';
create index quran_records_student_idx on public.quran_records (student_id);
create trigger trg_quran_records_updated_at before update on public.quran_records
  for each row execute function public.set_updated_at();

alter table public.monthly_reports
  add column return_note text check (return_note is null or char_length(return_note) <= 500);
comment on column public.monthly_reports.return_note is 'ملاحظةُ المعتمِد عند إعادة الرصد إلى المعلّم (إلزاميّة عند الإعادة).';

-- 2) حارسُ السجلّ
create or replace function private.guard_quran_record()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status public.report_status;
  v_halaqa uuid;
  v_found boolean;
  v_fs smallint;
  v_ts smallint;
  v_student_halaqa uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- الحذفُ التتابعيّ (حذفُ طالبٍ/تقريرٍ/حلقة) يجري في عمق ٢ فما فوق فيُتجاوَز؛ المباشرُ يبقى محظوراً.
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
    select r.status into v_status from public.monthly_reports r where r.id = old.report_id;
    if v_status = 'approved' then
      raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    if (new.report_id, new.student_id, new.from_surah, new.from_ayah, new.to_surah, new.to_ayah,
        new.pages_memorized, new.pages_reviewed, new.notes)
       is not distinct from
       (old.report_id, old.student_id, old.from_surah, old.from_ayah, old.to_surah, old.to_ayah,
        old.pages_memorized, old.pages_reviewed, old.notes) then
      return new;   -- تغيّر recorded_by وحده (تفريغٌ تتابعيّ)
    end if;
  end if;

  select r.status, r.halaqa_id, true into v_status, v_halaqa, v_found
    from public.monthly_reports r where r.id = new.report_id;
  if v_status = 'approved' then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;

  if new.from_surah is not null then
    select s.ayah_count into v_fs from public.surahs s where s.number = new.from_surah;
    select s.ayah_count into v_ts from public.surahs s where s.number = new.to_surah;
    if new.from_ayah < 1 or new.from_ayah > v_fs then
      raise exception 'آيةُ البداية خارج عدد آيات السورة (1-%)', v_fs;
    end if;
    if new.to_ayah < 1 or new.to_ayah > v_ts then
      raise exception 'آيةُ النهاية خارج عدد آيات السورة (1-%)', v_ts;
    end if;
    -- ترتيبُ الحفظ: السورة تنازلياً والآيةُ داخلها تصاعدياً.
    if not (new.from_surah > new.to_surah
            or (new.from_surah = new.to_surah and new.from_ayah <= new.to_ayah)) then
      raise exception 'بدايةُ المسار يجب أن تسبق نهايتَه بترتيب الحفظ (من الناس إلى الفاتحة)';
    end if;
  end if;

  if tg_op = 'INSERT' or new.student_id is distinct from old.student_id
     or new.report_id is distinct from old.report_id then
    select s.halaqa_id into v_student_halaqa from public.students s where s.id = new.student_id;
    if v_student_halaqa is distinct from v_halaqa then
      raise exception 'الطالب ليس في حلقة هذا التقرير';
    end if;
  end if;
  return new;
end;
$$;
create trigger quran_records_guard before insert or update or delete on public.quran_records
  for each row execute function private.guard_quran_record();

-- 3) الصلاحيات
alter table public.quran_records enable row level security;
revoke all on public.quran_records from public, anon, authenticated;
grant select, insert, update, delete on public.quran_records to authenticated;

create policy quran_records_read on public.quran_records for select to authenticated
  using (exists (
    select 1 from public.monthly_reports r where r.id = report_id and (
      public.can_view_halaqa(r.halaqa_id)
      or (student_id = public.my_student_id() and r.status = 'approved'))));
create policy quran_records_insert on public.quran_records for insert to authenticated
  with check (exists (
    select 1 from public.monthly_reports r where r.id = report_id and (
      (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft')
      or public.can_approve_report_in_halaqa(r.halaqa_id))));
create policy quran_records_update on public.quran_records for update to authenticated
  using (exists (
    select 1 from public.monthly_reports r where r.id = report_id and (
      (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft')
      or public.can_approve_report_in_halaqa(r.halaqa_id))))
  with check (exists (
    select 1 from public.monthly_reports r where r.id = report_id and (
      (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft')
      or public.can_approve_report_in_halaqa(r.halaqa_id))));
create policy quran_records_delete on public.quran_records for delete to authenticated
  using (exists (
    select 1 from public.monthly_reports r where r.id = report_id and (
      (public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft')
      or public.can_approve_report_in_halaqa(r.halaqa_id))));

-- كتابةُ التقارير: المعلّم، ومعتمِدُ الرصد (لا المديرُ الفنيّ).
drop policy reports_write on public.monthly_reports;
create policy reports_write on public.monthly_reports for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_approve_report_in_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_approve_report_in_halaqa(halaqa_id));

-- حارسُ حالة التقرير: المنطقُ القائم نفسُه مع دالّة معتمِد الرصد.
create or replace function public.guard_report_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not public.can_approve_report_in_halaqa(old.halaqa_id) then
      raise exception 'لا يُحذف التقرير بعد إرساله إلا بيد الإدارة' using errcode = '42501';
    end if;
    return old;
  end if;
  if public.can_approve_report_in_halaqa(new.halaqa_id)
     and (tg_op = 'INSERT' or public.can_approve_report_in_halaqa(old.halaqa_id)) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'لا يُعدَّل التقرير بعد إرساله إلا بيد الإدارة' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'لا تملك اعتماد التقرير' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' and (new.approved_by is not null or new.approved_at is not null))
     or (tg_op = 'UPDATE' and (new.approved_by, new.approved_at) is distinct from (old.approved_by, old.approved_at)) then
    raise exception 'لا تملك اعتماد التقرير' using errcode = '42501';
  end if;
  return new;
end $$;

-- 5) لقطةُ المطلوب الشهريّ
create or replace function private.monthly_reports_target_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.target_pages_snapshot is null then
    select s.target_memorization_pages into new.target_pages_snapshot from public.app_settings s limit 1;
  end if;
  return new;
end;
$$;
create trigger monthly_reports_target_snapshot before insert on public.monthly_reports
  for each row execute function private.monthly_reports_target_snapshot();

-- 6) مسارُ الحالات وقفلُ الشهر (يعمل قبل guard_report_status أبجدياً ولا يحلّ محلّه)
create or replace function private.report_opening_day(p_year int, p_month int)
returns date language sql immutable set search_path = '' as $$
  select case when extract(isodow from d) = 5 then d - 1 else d end
    from (select (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as d) x;
$$;

create or replace function private.monthly_reports_flow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_open date;
begin
  if auth.uid() is null or new.status is not distinct from old.status then
    return new;
  end if;
  if old.status = 'draft' and new.status = 'submitted' then
    v_open := private.report_opening_day(new.report_year, new.report_month);
    if private.attendance_today() < v_open then
      raise exception 'يُرصَد الشهر ابتداءً من %', to_char(v_open, 'DD-MM-YYYY');
    end if;
    new.submitted_at := private.attendance_today();
    new.return_note := null;
  elsif new.status = 'approved' then
    if old.status <> 'submitted' then
      raise exception 'لا يُعتمَد إلا رصدٌ مُرسَل';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif new.status = 'draft' and old.status in ('submitted', 'approved') then
    if btrim(coalesce(new.return_note, '')) = '' then
      raise exception 'الإعادةُ تحتاج ملاحظة';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;
create trigger monthly_reports_flow before update on public.monthly_reports
  for each row execute function private.monthly_reports_flow();

-- 7) مُنتِجو الإشعارات
create or replace function private.notify_report_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_teacher uuid;
  v_supervisor uuid;
  v_body text;
  v_tm uuid;
begin
  select h.name, h.teacher_id, h.supervisor_id into v_name, v_teacher, v_supervisor
    from public.halaqat h where h.id = new.halaqa_id;
  v_body := v_name || ' · ' || lpad(new.report_month::text, 2, '0') || '-' || new.report_year;

  if new.status = 'submitted' then
    perform private.notify(v_supervisor, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                           '/reports', 'monthly_reports', new.id);
    for v_tm in select p.id from public.profiles p where p.role = 'technical_manager' and p.status = 'active' loop
      perform private.notify(v_tm, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                             '/reports', 'monthly_reports', new.id);
    end loop;
  elsif new.status = 'approved' then
    perform private.notify(v_teacher, 'report_approved', 'اعتُمد رصدُ الشهر', v_body,
                           '/reports', 'monthly_reports', new.id);
  elsif new.status = 'draft' and old.status in ('submitted', 'approved') then
    perform private.notify(v_teacher, 'report_returned', 'أُعيد رصدُ الشهر إليك',
                           v_body || ' — ' || coalesce(new.return_note, ''),
                           '/reports', 'monthly_reports', new.id);
  end if;
  return null;
end;
$$;
create trigger monthly_reports_notify_status after update of status on public.monthly_reports
  for each row when (old.status is distinct from new.status)
  execute function private.notify_report_status();

revoke all on function private.guard_quran_record(), private.monthly_reports_target_snapshot(),
  private.report_opening_day(int, int), private.monthly_reports_flow(), private.notify_report_status()
  from public, anon, authenticated;

-- 8) قراءةُ الطالب لرصده المعتمَد
create or replace function public.my_approved_pages()
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(q.pages_memorized), 0)::bigint
    from public.quran_records q
    join public.monthly_reports m on m.id = q.report_id
   where q.student_id = public.my_student_id()
     and m.status = 'approved';
$$;

create or replace function public.my_quran_months()
returns table (report_year int, report_month int, from_surah smallint, from_ayah smallint,
               to_surah smallint, to_ayah smallint, pages_memorized smallint, pages_reviewed smallint)
language sql stable security definer set search_path = '' as $$
  select m.report_year, m.report_month, q.from_surah, q.from_ayah, q.to_surah, q.to_ayah,
         q.pages_memorized, q.pages_reviewed
    from public.quran_records q
    join public.monthly_reports m on m.id = q.report_id
   where q.student_id = public.my_student_id()
     and m.status = 'approved'
   order by m.report_year, m.report_month;
$$;
revoke all on function public.my_approved_pages(), public.my_quran_months() from public, anon;
grant execute on function public.my_approved_pages(), public.my_quran_months() to authenticated;

-- 9) الفحصُ الذاتيّ: يرفع استثناءً عند أيّ خلل فتُلغى الهجرة كلّها.
do $$
declare
  p text;
  v_tm uuid;
  v_admin uuid;
  v_halaqa uuid;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.quran_records'::regclass) then
    raise exception 'quran_records: RLS غير مفعّل';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'quran_records') <> 4 then
    raise exception 'quran_records: السياسات ليست 4';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'quran_records' and cmd = 'SELECT') <> 1 then
    raise exception 'quran_records: سياسة القراءة ليست واحدة';
  end if;
  foreach p in array array['select', 'insert', 'update', 'delete'] loop
    if not has_table_privilege('authenticated', 'public.quran_records', p) then
      raise exception 'quran_records: authenticated بلا %', p;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.quran_records', 'select') then
    raise exception 'quran_records: منحٌ لـanon';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'quran_records' and grantee = 'PUBLIC') then
    raise exception 'quran_records: منحٌ لـPUBLIC';
  end if;

  if (select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.quran_records'::regclass
        and tgname in ('quran_records_guard', 'trg_quran_records_updated_at')) <> 2 then
    raise exception 'مُشغّلات quran_records ناقصة';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.monthly_reports'::regclass
        and tgname in ('monthly_reports_flow', 'monthly_reports_notify_status', 'monthly_reports_target_snapshot',
                       'monthly_reports_guard_status')) <> 4 then
    raise exception 'مُشغّلات monthly_reports ناقصة';
  end if;
  if (select qual from pg_policies where tablename = 'monthly_reports' and policyname = 'reports_write')
       not like '%can_approve_report_in_halaqa%' then
    raise exception 'reports_write لا تستعمل معتمِدَ الرصد';
  end if;
  if pg_get_functiondef('public.guard_report_status()'::regprocedure) like '%can_approve_in_halaqa%' then
    raise exception 'guard_report_status ما زال يستعمل can_approve_in_halaqa';
  end if;
  if pg_get_functiondef('public.my_approved_pages()'::regprocedure) like '%monthly_report_students%' then
    raise exception 'my_approved_pages ما زالت على الجدول القديم';
  end if;
  if has_function_privilege('anon', 'public.my_quran_months()', 'execute')
     or not has_function_privilege('authenticated', 'public.my_quran_months()', 'execute') then
    raise exception 'my_quran_months: المنوح خطأ';
  end if;
  if not has_function_privilege('authenticated', 'public.can_approve_report_in_halaqa(uuid)', 'execute')
     or has_function_privilege('anon', 'public.can_approve_report_in_halaqa(uuid)', 'execute') then
    raise exception 'can_approve_report_in_halaqa: المنوح خطأ';
  end if;
  if private.report_opening_day(2026, 7) <> date '2026-07-30' then
    raise exception 'report_opening_day(2026,7) ليس 2026-07-30';
  end if;
  if private.report_opening_day(2026, 10) <> date '2026-10-31' then
    raise exception 'report_opening_day(2026,10) ليس 2026-10-31';
  end if;

  -- المديرُ الفنيّ يقرأ التقارير ولا يعتمد؛ والمديرُ الإداريّ يعتمد احتياطاً (إن وُجدا في القاعدة).
  select id into v_tm from public.profiles where role = 'technical_manager' and status = 'active' limit 1;
  select id into v_admin from public.profiles where role = 'admin_manager' and status = 'active' limit 1;
  select id into v_halaqa from public.halaqat limit 1;
  if v_halaqa is not null then
    if v_tm is not null then
      perform set_config('request.jwt.claim.sub', v_tm::text, true);
      if public.can_approve_report_in_halaqa(v_halaqa) then
        raise exception 'المديرُ الفنيّ يعتمد!';
      end if;
      if not public.can_view_halaqa(v_halaqa) then
        raise exception 'المديرُ الفنيّ لا يقرأ!';
      end if;
    end if;
    if v_admin is not null then
      perform set_config('request.jwt.claim.sub', v_admin::text, true);
      if not public.can_approve_report_in_halaqa(v_halaqa) then
        raise exception 'المديرُ الإداريّ لا يعتمد!';
      end if;
    end if;
    perform set_config('request.jwt.claim.sub', '', true);
  end if;
end $$;
