-- المدير الفنيّ لقسم البنين وحده (قرار المستخدم 2026-10-22): لا يطّلع على شيءٍ من الإناث — حلقاتٍ ولا طالباتٍ
-- ولا مشرفاتٍ ولا معلّماتٍ ولا زيارات؛ وقسمُ البنات كاملاً للمديرة الإدارية (والمدير الإداري ومشرف المشروع للقسمين).

-- ── النطاقُ المشترك: الحلقاتُ وما يتبعها ──
create or replace function public.visible_halaqa_ids()
 returns uuid[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(array_agg(h.id), '{}') from public.halaqat h where
         public.is_project_supervisor()
      or public.current_user_role() = 'admin_manager'
      or (public.current_user_role() = 'technical_manager' and h.gender = 'male')
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')
      or (public.current_user_role() is not null and auth.uid() in (h.supervisor_id, h.examiner_id, h.teacher_id));
$function$;

create or replace function public.can_view_halaqa(hid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.is_project_supervisor()
      or public.current_user_role() = 'admin_manager'
      or (public.current_user_role() = 'technical_manager' and h.gender = 'male')
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')
      or (public.current_user_role() is not null  -- الإسناد لا يكفي لحسابٍ غير نشط
          and auth.uid() in (h.supervisor_id, h.examiner_id, h.teacher_id))
    ));
$function$;

create or replace function public.can_manage_halaqa(hid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.halaqat h where h.id = hid and (
           public.current_user_role() = 'admin_manager'
        or (public.current_user_role() = 'technical_manager' and h.gender = 'male')));
$function$;

create or replace function public.can_approve_in_halaqa(hid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.current_user_role() = 'admin_manager'
      or (public.current_user_role() = 'technical_manager' and h.gender = 'male')
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')));
$function$;

create or replace function public.in_admin_scope(g gender_type)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
       public.current_user_role() = 'admin_manager'
    or (public.current_user_role() = 'technical_manager' and g = 'male')
    or (public.current_user_role() = 'women_admin' and g = 'female'), false);
$function$;

-- ── ملفّاتُ العاملات: لا يراها المدير الفنيّ ──
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    (coalesce(public.current_user_role() <> 'student', false)
      and not (public.current_user_role() = 'technical_manager' and gender = 'female'))
    or id = (select auth.uid())
  );

-- ── التنبيهاتُ الإدارية: الفنيُّ تنبيهاتِ معلّمي البنين وحدهم ──
drop policy alerts_select on public.admin_alerts;
create policy alerts_select on public.admin_alerts for select to authenticated
  using (
    issuer_id = (select auth.uid()) or teacher_id = (select auth.uid())
    or public.is_project_supervisor()
    or public.current_user_role() = 'admin_manager'
    or (public.current_user_role() = 'technical_manager'
        and not exists (select 1 from public.profiles p where p.id = admin_alerts.teacher_id and p.gender = 'female'))
    or (public.is_women_admin() and exists (select 1 from public.halaqat h
          where h.teacher_id = admin_alerts.teacher_id and h.gender = 'female'))
  );

-- ── محاولاتُ اختبار القراءة: الفنيُّ بنطاق الحلقات لا الكلّ ──
drop policy reading_attempts_select on public.reading_attempts;
create policy reading_attempts_select on public.reading_attempts for select to authenticated
  using (
    student_id = (select public.my_student_id())
    or public.current_user_role() in ('admin_manager', 'project_supervisor')
    or exists (select 1 from public.students s
                where s.id = reading_attempts.student_id
                  and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
  );

-- ── فتحُ المقفل وملاحظاتُ الإدارة: الفنيُّ في حلقات البنين وحدها ──
create or replace function public.unlock_visit_result(p_visit uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_sup uuid;
  v_name text;
begin
  perform private.assert_session_writable();
  if coalesce(public.current_user_role()::text, '') not in ('admin_manager', 'technical_manager') then
    raise exception 'فتحُ الزيارة للتعديل للمدير الإداري والفنيّ وحدهما.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.supervision_visits v where v.id = p_visit and public.can_view_halaqa(v.halaqa_id)) then
    raise exception 'الزيارة خارج نطاقك.' using errcode = '42501';
  end if;
  perform set_config('torjoman.visit_unlock', p_visit::text, true);
  update public.supervision_visits v set locked_at = null
   where v.id = p_visit and v.locked_at is not null
  returning v.supervisor_id, (select h.name from public.halaqat h where h.id = v.halaqa_id) into v_sup, v_name;
  perform set_config('torjoman.visit_unlock', '', true);
  if v_sup is null then
    raise exception 'الزيارة غير مقفلة أو غير موجودة.';
  end if;
  perform private.notify(v_sup, 'visit_unlocked', 'فُتحت زيارةٌ للتعديل', coalesce(v_name, 'حلقة') || ' — صحّح النتيجة ثم احفظها',
                         '/visits', 'supervision_visits', p_visit);
end;
$function$;

create or replace function public.unlock_quality_month(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_label text;
begin
  perform private.assert_session_writable();
  if coalesce(public.current_user_role()::text, '') not in ('admin_manager', 'technical_manager') then
    raise exception 'فتحُ السجلّ للمدير الإداري والفنيّ وحدهما.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teacher_quality_months q where q.id = p_id and public.can_view_halaqa(q.halaqa_id)) then
    raise exception 'السجلّ خارج نطاقك.' using errcode = '42501';
  end if;
  update public.teacher_quality_months q set locked_at = null, teacher_ack_at = null
   where q.id = p_id and q.locked_at is not null
  returning (select h.name from public.halaqat h where h.id = q.halaqa_id) || ' · '
            || lpad(q.month::text, 2, '0') || '-' || q.year
    into v_label;
  if v_label is null then
    raise exception 'السجلّ غير مقفل أو غير موجود.';
  end if;
  -- الراصدُ المدير الإداري: يُشعَر إن فتحه الفنيّ (ولا يُشعَر أحدٌ بفعله هو)
  perform private.notify(p.id, 'quality_unlocked', 'فُتح سجلُّ تقييمٍ للتعديل', v_label || ' — صحّحه ثم احفظه',
                         '/quality', 'teacher_quality_months', p_id)
     from public.profiles p where p.role = 'admin_manager' and p.status = 'active';
end;
$function$;

create or replace function public.set_quality_admin_notes(p_id uuid, p_notes text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'technical_manager' then
    raise exception 'ملاحظاتُ الإدارة للمدير الفنيّ.' using errcode = '42501';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'الملاحظات أطول من 2000 حرف.' using errcode = '23514';
  end if;
  update public.teacher_quality_months q
     set admin_notes = nullif(btrim(coalesce(p_notes, '')), ''), admin_notes_by = (select auth.uid()), admin_notes_at = now()
   where q.id = p_id and public.can_view_halaqa(q.halaqa_id);
  if not found then
    raise exception 'السجلّ غير موجود أو خارج نطاقك.';
  end if;
end;
$function$;

-- ── تغييرُ موعد الزيارة: المديرُ الإداري دائماً، والفنيُّ للبنين، والمديرةُ للبنات ──
create or replace function private.notify_visit_changes()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_halaqa text;
  v_gender text;
  v_teacher uuid;
  v_sup text;
  v_reason text;
  v_to uuid;
begin
  select h.name, h.teacher_id, h.gender::text into v_halaqa, v_teacher, v_gender from public.halaqat h where h.id = new.halaqa_id;

  -- أُقفلت النتيجة الآن ← المعلم
  if new.locked_at is not null and old.locked_at is null then
    perform private.notify(v_teacher, 'visit_result', 'نتيجةُ زيارةٍ إشرافية لحلقتك',
      coalesce(v_halaqa, 'حلقة') || ' · ' || coalesce(new.score::text, '—') || ' من 42 — اطّلع عليها وأقِرّ',
      '/visits', 'supervision_visits', new.id);
  end if;

  -- تغيّر الموعد ← الإدارةُ في نطاق الحلقة (السببُ من سجلّ التغيير في المعاملة نفسها)
  if new.scheduled_at is distinct from old.scheduled_at then
    select p.full_name into v_sup from public.profiles p where p.id = new.supervisor_id;
    select l.reason into v_reason from public.visit_reschedule_log l
     where l.visit_id = new.id and l.new_time = new.scheduled_at order by l.changed_at desc limit 1;
    for v_to in select p.id from public.profiles p
                 where p.status = 'active' and (
                       p.role = 'admin_manager'
                    or (p.role = 'technical_manager' and v_gender = 'male')
                    or (p.role = 'women_admin' and v_gender = 'female')) loop
      perform private.notify(v_to, 'visit_rescheduled', 'غيّر مشرفٌ موعدَ زيارة',
        coalesce(v_sup, 'المشرف') || ' · ' || coalesce(v_halaqa, 'حلقة') || ' · '
          || to_char(old.scheduled_at at time zone 'Asia/Gaza', 'DD-MM-YYYY HH24:MI') || ' ← '
          || to_char(new.scheduled_at at time zone 'Asia/Gaza', 'DD-MM-YYYY HH24:MI')
          || coalesce(' — ' || v_reason, ''),
        '/visits', 'supervision_visits', new.id);
    end loop;
  end if;
  return null;
end;
$function$;
