-- قرار المستخدم 2026-10-21: «المشرفُ يعتمد الإنجاز القرآني لكلّ معلّميه، والمعلمُ يسلّم للمشرف وحده».
-- ١) المعتمِدُ المشرفُ الميدانيُّ لحلقاته وحده — لا المديرُ الإداري ولا المديرةُ الإدارية احتياطاً بعد اليوم.
--    `can_approve_report_in_halaqa` يحكم `reports_write` وسياساتِ `quran_records` والمسارَ والحارس، فيتبعه كلُّها.
-- ٢) المديرُ الإداري يبقى وحده من يحذف تقريراً بعد إرساله (حارس `guard_report_status`)، وكان حذفُه يمرّ عبر
--    `reports_write` بصفته معتمِداً — فله سياسةُ حذفٍ مستقلّة.
-- ٣) لا يُرسَل رصدُ حلقةٍ بلا مشرف (لا أحدَ يعتمده) — يُرفض الإرسال برسالةٍ تطلب الإسناد.
-- ٤) إشعارُ الإرسال للمشرف وحده: لا للمدير الفنيّ، ولا للإدارة بديلاً.

create or replace function public.can_approve_report_in_halaqa(hid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.halaqat h
     where h.id = hid
       and public.current_user_role() = 'field_supervisor'
       and h.supervisor_id = auth.uid());
$function$;

create policy reports_admin_delete on public.monthly_reports for delete to authenticated
  using ((select public.is_admin_manager()));

create or replace function private.monthly_reports_flow()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
    -- المشرفُ وحده يعتمد (قرار 2026-10-21): حلقةٌ بلا مشرف لا يُرسَل رصدُها إلى أحد
    if (select h.supervisor_id from public.halaqat h where h.id = new.halaqa_id) is null then
      raise exception 'لا مشرفَ لهذه الحلقة يعتمد رصدَها — تواصل مع الإدارة لإسناد مشرف';
    end if;
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
$function$;

create or replace function private.notify_report_status()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_name text;
  v_teacher uuid;
  v_supervisor uuid;
  v_body text;
  v_link text;
begin
  select h.name, h.teacher_id, h.supervisor_id into v_name, v_teacher, v_supervisor
    from public.halaqat h where h.id = new.halaqa_id;
  v_body := v_name || ' · ' || lpad(new.report_month::text, 2, '0') || '-' || new.report_year;
  v_link := '/reports?y=' || new.report_year || '&m=' || new.report_month;

  if new.status = 'submitted' then
    -- للمشرف وحده (قرار 2026-10-21) — والمسارُ يرفض الإرسال في حلقةٍ بلا مشرف
    perform private.notify(v_supervisor, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                           v_link, 'monthly_reports', new.id);
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
$function$;

do $$
begin
  if pg_get_functiondef('public.can_approve_report_in_halaqa'::regproc) ~ '(admin_manager|women_admin)' then
    raise exception 'can_approve_report_in_halaqa ما زال يمنح الإدارة';
  end if;
  if not has_function_privilege('authenticated', 'public.can_approve_report_in_halaqa(uuid)', 'execute') then
    raise exception 'سُحب منحُ can_approve_report_in_halaqa';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'monthly_reports' and policyname = 'reports_admin_delete') then
    raise exception 'سياسةُ حذف الإداري غائبة';
  end if;
  if pg_get_functiondef('private.notify_report_status'::regproc) ~ 'technical_manager' then
    raise exception 'إشعارُ الإرسال ما زال يصل الفنيّ';
  end if;
end $$;
