-- إصلاحاتُ المراجعة النهائية للرصد القرآنيّ (2026-10-19).
--  ١) لقطةُ المطلوب الشهريّ لا تُزوَّر: عند الإدراج بيد مستخدمٍ تُصفَّر فيملؤها monthly_reports_target_snapshot
--     من app_settings (مُشغّل flow يسبقه أبجدياً)، وعند التحديث تُستعاد القديمة.
--  ٢) حارسُ السجلّ: التحديثُ التتابعيّ (recorded_by on delete set null) يمرّ قبل فحص الشهر المعتمَد.
--  ٣) روابطُ إشعارات الرصد تفتح الشهر بعينه: /reports?y=<سنة>&m=<شهر>.
--  ٤) منعُ الشهر المستقبليّ بتاريخ غزّة (private.attendance_today()) لا UTC.

-- ١) مسارُ الحالات + لقطة المطلوب
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
    -- اللقطة تُملأ من الإعدادات وحدها: يصفّرها هذا المُشغّل ثم يملؤها monthly_reports_target_snapshot (يليه أبجدياً).
    new.target_pages_snapshot := null;
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

  -- حقولُ الإرسال والاعتماد واللقطة يضبطها المسارُ وحده؛ أيُّ قيمةٍ قادمةٍ من العميل تُهمَل.
  new.submitted_at := old.submitted_at;
  new.approved_by := old.approved_by;
  new.approved_at := old.approved_at;
  new.target_pages_snapshot := old.target_pages_snapshot;
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

-- ٢) حارسُ السجلّ: التحديثُ التتابعيّ غيرُ المغيِّر للبيانات يمرّ قبل فحص الشهر المعتمَد
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
    -- التحديثُ التتابعيّ لـrecorded_by (on delete set null) لا يغيّر بياناتٍ فيمرّ ولو كان الشهرُ معتمَداً.
    if tg_op = 'UPDATE' and pg_trigger_depth() > 1
       and (new.report_id, new.student_id, new.from_surah, new.from_ayah, new.to_surah, new.to_ayah,
            new.pages_memorized, new.pages_reviewed, new.notes)
           is not distinct from
           (old.report_id, old.student_id, old.from_surah, old.from_ayah, old.to_surah, old.to_ayah,
            old.pages_memorized, old.pages_reviewed, old.notes) then
      return new;   -- تفريغٌ تتابعيّ لـrecorded_by
    end if;
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
      return new;   -- تغيّر recorded_by وحده
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

-- ٣) روابطُ الإشعارات تفتح الشهر بعينه
create or replace function private.notify_report_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_gender public.gender_type;
  v_teacher uuid;
  v_supervisor uuid;
  v_body text;
  v_link text;
  v_to uuid;
begin
  select h.name, h.gender, h.teacher_id, h.supervisor_id into v_name, v_gender, v_teacher, v_supervisor
    from public.halaqat h where h.id = new.halaqa_id;
  v_body := v_name || ' · ' || lpad(new.report_month::text, 2, '0') || '-' || new.report_year;
  v_link := '/reports?y=' || new.report_year || '&m=' || new.report_month;

  if new.status = 'submitted' then
    if v_supervisor is not null then
      perform private.notify(v_supervisor, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                             v_link, 'monthly_reports', new.id);
    else
      for v_to in select p.id from public.profiles p
                   where p.status = 'active'
                     and (p.role = 'admin_manager' or (p.role = 'women_admin' and v_gender = 'female')) loop
        perform private.notify(v_to, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                               v_link, 'monthly_reports', new.id);
      end loop;
    end if;
    for v_to in select p.id from public.profiles p where p.role = 'technical_manager' and p.status = 'active' loop
      perform private.notify(v_to, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                             v_link, 'monthly_reports', new.id);
    end loop;
  elsif new.status = 'approved' then
    perform private.notify(v_teacher, 'report_approved', 'اعتُمد رصدُ الشهر', v_body,
                           v_link, 'monthly_reports', new.id);
  elsif new.status = 'draft' and old.status in ('submitted', 'approved') then
    perform private.notify(v_teacher, 'report_returned', 'أُعيد رصدُ الشهر إليك',
                           v_body || ' — ' || coalesce(new.return_note, ''),
                           v_link, 'monthly_reports', new.id);
  end if;
  return null;
end;
$$;

-- ٤) منعُ الشهر المستقبليّ بتاريخ غزّة (security definer كي تُستدعى دالّة private بصلاحية المالك)
create or replace function public.prevent_future_report_month()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if make_date(new.report_year, new.report_month, 1)
     > date_trunc('month', private.attendance_today())::date then
    raise exception 'لا يمكن إنشاء تقرير لشهر لم يبدأ بعد';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_future_report_month() from public, anon, authenticated;

revoke all on function private.monthly_reports_flow(), private.notify_report_status(), private.guard_quran_record()
  from public, anon, authenticated;

-- الفحصُ الذاتيّ: يرفع استثناءً عند أيّ خلل فتُلغى الهجرة كلّها.
do $$
declare
  v_first text;
begin
  -- ترتيبُ مُشغّلات الإدراج (BEFORE ... ROW): التصفيرُ في flow يسبق ملءَ اللقطة في monthly_reports_target_snapshot.
  if (select count(*) from pg_trigger where tgrelid = 'public.monthly_reports'::regclass and not tgisinternal
        and tgname in ('monthly_reports_flow', 'monthly_reports_target_snapshot')) <> 2
     or 'monthly_reports_flow'::name >= 'monthly_reports_target_snapshot'::name then
    raise exception 'ترتيب المُشغّلات: monthly_reports_flow لا يسبق monthly_reports_target_snapshot';
  end if;
  if (select (tgtype & 4) = 4 and (tgtype & 2) = 2 from pg_trigger
       where tgname = 'monthly_reports_target_snapshot' and tgrelid = 'public.monthly_reports'::regclass) is not true then
    raise exception 'monthly_reports_target_snapshot ليس قبل الإدراج';
  end if;
  if position('new.target_pages_snapshot := null' in pg_get_functiondef('private.monthly_reports_flow()'::regprocedure)) = 0
     or position('new.target_pages_snapshot := old.target_pages_snapshot' in pg_get_functiondef('private.monthly_reports_flow()'::regprocedure)) = 0 then
    raise exception 'monthly_reports_flow: حمايةُ اللقطة ناقصة';
  end if;
  if position('انتقالٌ غيرُ مسموح' in pg_get_functiondef('private.monthly_reports_flow()'::regprocedure)) = 0 then
    raise exception 'monthly_reports_flow: القواعد ناقصة';
  end if;
  -- حارسُ السجلّ: الاختصارُ التتابعيّ قبل فحص الشهر المعتمَد
  v_first := pg_get_functiondef('private.guard_quran_record()'::regprocedure);
  if position('تفريغٌ تتابعيّ لـrecorded_by' in v_first) = 0
     or position('تفريغٌ تتابعيّ لـrecorded_by' in v_first) > position('الشهر معتمَد' in v_first) then
    raise exception 'guard_quran_record: الاختصار التتابعيّ بعد فحص الشهر المعتمَد';
  end if;
  v_first := pg_get_functiondef('private.notify_report_status()'::regprocedure);
  if position('/reports?y=' in v_first) = 0 or position('''/reports'',' in v_first) > 0 then
    raise exception 'notify_report_status: الرابطُ لا يحمل السنة والشهر';
  end if;
  if position('private.attendance_today()' in pg_get_functiondef('public.prevent_future_report_month()'::regprocedure)) = 0
     or position('current_date' in pg_get_functiondef('public.prevent_future_report_month()'::regprocedure)) > 0 then
    raise exception 'prevent_future_report_month: ليست على تاريخ غزّة';
  end if;
  if (select proconfig from pg_proc where oid = 'public.prevent_future_report_month()'::regprocedure) is distinct from array['search_path=""'] then
    raise exception 'prevent_future_report_month: search_path ليس فارغاً';
  end if;
end $$;
