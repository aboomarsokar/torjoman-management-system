-- تصليبُ مسار حالات الرصد (جولة المراجعة ١، 2026-10-19).
--  ١) الإنشاءُ مسوّدةً فقط، وتُصفَّر submitted_at/approved_by/approved_at/return_note عند الإدراج.
--  ٢) التحديثُ بلا تغيّر حالة لا يزوّر حقول الإرسال/الاعتماد (تُستعاد القديمة)، ولا يغيّر المعلّمُ return_note.
--  ٣) لا يُنقل الرصدُ إلى حلقةٍ أو شهرٍ آخر.
--  ٤) قائمةٌ بيضاء للانتقالات: draft→submitted، submitted→approved، submitted→draft، approved→draft.
--  ٦) حذفُ تقريرٍ غير مسوّدة بيد المدير الإداري وحده.
--  ٧) سياسةُ قراءة quran_records بلا فرع الطالب الميّت (يقرأ الطالبُ عبر my_quran_months()/my_approved_pages()).
--  ٩) غيابُ مشرفٍ ميدانيّ للحلقة: يصل إشعارُ الإرسال للمعتمِدين الاحتياط (المدير الإداري، والمديرة إن كانت الحلقة للبنات).
--  ١٠) إزالة v_found غير المستعمل.
-- (البند ٥: حارسا الحضور الحيّان يضعان اختصار «تغيّر recorded_by وحده» قبل فحص الشهر المعتمَد أصلاً — يُثبَت بالاختبار.)

-- ١-٤، ٨) مسارُ الحالات: قبل الإدراج والتحديث.
create or replace function private.monthly_reports_flow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_open date;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'يُنشأ الرصدُ مسوّدةً ثم يُرسَل';
    end if;
    new.submitted_at := null;
    new.approved_by := null;
    new.approved_at := null;
    new.return_note := null;
    return new;
  end if;

  -- التحديثُ التتابعيّ (مثل on delete set null لـapproved_by عند حذف حساب) لا يمسّه المسار.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if (new.halaqa_id, new.report_month, new.report_year)
     is distinct from (old.halaqa_id, old.report_month, old.report_year) then
    raise exception 'لا يُنقل الرصدُ إلى حلقةٍ أو شهرٍ آخر';
  end if;

  -- حقولُ الإرسال والاعتماد يضبطها المسارُ وحده؛ أيُّ قيمةٍ قادمةٍ من العميل تُهمَل.
  new.submitted_at := old.submitted_at;
  new.approved_by := old.approved_by;
  new.approved_at := old.approved_at;
  if not public.can_approve_report_in_halaqa(new.halaqa_id) then
    new.return_note := old.return_note;   -- ملاحظةُ الإعادة للمعتمِد وحده
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if (old.status::text, new.status::text) not in
     (('draft', 'submitted'), ('submitted', 'approved'), ('submitted', 'draft'), ('approved', 'draft')) then
    raise exception 'انتقالٌ غيرُ مسموح';
  end if;

  if new.status = 'submitted' then
    v_open := private.report_opening_day(new.report_year, new.report_month);
    if private.attendance_today() < v_open then
      raise exception 'يُرصَد الشهر ابتداءً من %', to_char(v_open, 'DD-MM-YYYY');
    end if;
    new.submitted_at := private.attendance_today();
    new.return_note := null;
  elsif new.status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  else  -- إعادةٌ إلى المسوّدة
    if btrim(coalesce(new.return_note, '')) = '' then
      raise exception 'الإعادةُ تحتاج ملاحظة';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;
drop trigger monthly_reports_flow on public.monthly_reports;
create trigger monthly_reports_flow before insert or update on public.monthly_reports
  for each row execute function private.monthly_reports_flow();

-- ٦) حذفُ تقريرٍ بعد الإرسال: المدير الإداري وحده (المسوّداتُ كما كانت).
create or replace function public.guard_report_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and public.current_user_role() is distinct from 'admin_manager' then
      raise exception 'لا يُحذف التقرير بعد إرساله إلا بيد المدير الإداري' using errcode = '42501';
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

-- ٧) قراءةُ السجلّ: من يرى الحلقة. الطالبُ يقرأ رصده المعتمَد عبر my_quran_months()/my_approved_pages()
--    (security definer) لأنّ تقريرَ الحلقة لا يظهر له بـRLS فلا ينفع فرعٌ له هنا.
drop policy quran_records_read on public.quran_records;
create policy quran_records_read on public.quran_records for select to authenticated
  using (exists (
    select 1 from public.monthly_reports r where r.id = report_id and public.can_view_halaqa(r.halaqa_id)));

-- ٩) إشعارُ الإرسال: مشرفُ الحلقة، وإن لم يكن لها مشرفٌ فالمعتمِدون الاحتياط.
create or replace function private.notify_report_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_gender public.gender_type;
  v_teacher uuid;
  v_supervisor uuid;
  v_body text;
  v_to uuid;
begin
  select h.name, h.gender, h.teacher_id, h.supervisor_id into v_name, v_gender, v_teacher, v_supervisor
    from public.halaqat h where h.id = new.halaqa_id;
  v_body := v_name || ' · ' || lpad(new.report_month::text, 2, '0') || '-' || new.report_year;

  if new.status = 'submitted' then
    if v_supervisor is not null then
      perform private.notify(v_supervisor, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                             '/reports', 'monthly_reports', new.id);
    else
      for v_to in select p.id from public.profiles p
                   where p.status = 'active'
                     and (p.role = 'admin_manager' or (p.role = 'women_admin' and v_gender = 'female')) loop
        perform private.notify(v_to, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                               '/reports', 'monthly_reports', new.id);
      end loop;
    end if;
    for v_to in select p.id from public.profiles p where p.role = 'technical_manager' and p.status = 'active' loop
      perform private.notify(v_to, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
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

-- ١٠) حارسُ السجلّ بلا v_found.
create or replace function private.guard_quran_record()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status public.report_status;
  v_halaqa uuid;
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

  select r.status, r.halaqa_id into v_status, v_halaqa
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

revoke all on function private.monthly_reports_flow(), private.notify_report_status(), private.guard_quran_record()
  from public, anon, authenticated;

-- الفحصُ الذاتيّ: يرفع استثناءً عند أيّ خلل فتُلغى الهجرة كلّها.
do $$
begin
  if pg_get_triggerdef((select oid from pg_trigger where tgname = 'monthly_reports_flow'
                          and tgrelid = 'public.monthly_reports'::regclass))
       not like '%BEFORE INSERT OR UPDATE ON public.monthly_reports%' then
    raise exception 'monthly_reports_flow ليس قبل الإدراج والتحديث';
  end if;
  if pg_get_functiondef('private.monthly_reports_flow()'::regprocedure) not like '%انتقالٌ غيرُ مسموح%'
     or pg_get_functiondef('private.monthly_reports_flow()'::regprocedure) not like '%يُنشأ الرصدُ مسوّدةً%'
     or pg_get_functiondef('private.monthly_reports_flow()'::regprocedure) not like '%لا يُنقل الرصدُ%' then
    raise exception 'monthly_reports_flow: القواعد ناقصة';
  end if;
  if pg_get_functiondef('public.guard_report_status()'::regprocedure) not like '%is distinct from ''admin_manager''%' then
    raise exception 'guard_report_status: حذفُ غير المسوّدة ليس للمدير الإداري وحده';
  end if;
  if (select qual from pg_policies where tablename = 'quran_records' and policyname = 'quran_records_read') like '%my_student_id%' then
    raise exception 'quran_records_read: ما زال فيها فرع الطالب';
  end if;
  if (select count(*) from pg_policies where tablename = 'quran_records') <> 4 then
    raise exception 'quran_records: السياسات ليست 4';
  end if;
  if pg_get_functiondef('private.notify_report_status()'::regprocedure) not like '%women_admin%'
     or pg_get_functiondef('private.notify_report_status()'::regprocedure) not like '%v_supervisor is not null%' then
    raise exception 'notify_report_status: الاحتياط ناقص';
  end if;
  if pg_get_functiondef('private.guard_quran_record()'::regprocedure) like '%v_found%' then
    raise exception 'guard_quran_record: v_found باقٍ';
  end if;
  -- حارسا الحضور: اختصارُ recorded_by قبل فحص الشهر المعتمَد
  if position('return new;   -- تغيّر recorded_by' in pg_get_functiondef('private.guard_attendance_absences()'::regprocedure))
     > position('attendance_month_approved(new.halaqa_id' in pg_get_functiondef('private.guard_attendance_absences()'::regprocedure))
     or position('return new;   -- تغيّر recorded_by' in pg_get_functiondef('private.guard_attendance_days()'::regprocedure))
     > position('attendance_month_approved(new.halaqa_id' in pg_get_functiondef('private.guard_attendance_days()'::regprocedure)) then
    raise exception 'حارسا الحضور: اختصار recorded_by بعد فحص الشهر';
  end if;
end $$;
