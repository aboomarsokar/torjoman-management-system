-- نموذجُ الزيارة الإشرافية (قرارات المستخدم 2026-10-21) — المرحلة ١ من «نموذج الزيارة وسجلّ الجودة»:
-- ١) بنودُ الخصم الأربعة عشر في جدولٍ ثابت (ستّةُ معايير، لكلٍّ 7 درجات، والخصمُ = عددُ المرّات × خصمُ المرّة)،
--    والزيارةُ تحفظ عددَ المرّات لكلّ بند (`deductions`)، والقاعدةُ تحسب محصّلاتِ المعايير والمجموعَ من 42.
-- ٢) حفظُ النتيجة يُقفل الزيارةَ على المشرف (`locked_at`)؛ يفتحها المدير الإداري أو الفنيّ (`unlock_visit_result`)
--    فيصحّح المشرف ويحفظ فتُقفل ثانيةً.
-- ٣) المعلمُ يُشعَر بالنتيجة ويُقرّ بالاطّلاع (`acknowledge_visit`) بدل التوقيع الورقيّ.
-- ٤) تغييرُ المشرف موعدَ الزيارة يُشعِر المديرَ الإداري والفنيّ (طلب المستخدم 2026-10-21).
-- الحقولُ القديمة (flow_rating/strengths/improvements/recommendations) باقيةٌ لزياراتٍ سبقت ولا يكتبها النموذج.

-- ── البنود ──
create table public.visit_deduction_items (
  key text primary key check (key ~ '^[a-z_]+$'),
  criterion smallint not null check (criterion between 1 and 6),
  criterion_label text not null,
  criterion_hint text,
  label text not null,
  per_time smallint not null check (per_time between 1 and 7),
  sort_order smallint not null unique
);
alter table public.visit_deduction_items enable row level security;
create policy visit_items_read on public.visit_deduction_items for select to authenticated using (true);
revoke all on public.visit_deduction_items from anon, public;
grant select on public.visit_deduction_items to authenticated;
-- لا كتابةَ من الواجهة؛ والحارسُ لاتّساق قاعدة «كلُّ جدولٍ عامّ محروسٌ في النيابة»
select private.guard_table_for_impersonation('public.visit_deduction_items'::regclass, false);

insert into public.visit_deduction_items (key, criterion, criterion_label, criterion_hint, label, per_time, sort_order) values
  ('absence_excused',      1, 'الحضور والغياب',            null,                                             'غياب بإذن', 2, 1),
  ('absence_unexcused',    1, 'الحضور والغياب',            null,                                             'غياب بغير إذن', 3, 2),
  ('undocumented_day',     2, 'التوثيق الورقي',            'التسجيل على السجل',                              'كلّ يوم لا يُدوَّن فيه', 1, 3),
  ('teacher_distracted',   3, 'ضبط الحلقة',                'إدارة المعلم لحلقته وانضباط أجوائها',            'انشغال المعلم عن حلقته بالجوال أو بحديث خارجها', 3, 4),
  ('weak_control',         3, 'ضبط الحلقة',                'إدارة المعلم لحلقته وانضباط أجوائها',            'ضعف سيطرة المعلم على الحلقة وانضباط طلابها', 3, 5),
  ('incident_mishandled',  3, 'ضبط الحلقة',                'إدارة المعلم لحلقته وانضباط أجوائها',            'معالجة موقف طارئ بغير الأسلوب السليم', 3, 6),
  ('passed_over_mistakes', 4, 'ضبط المعلم',                'دقّته في التسميع والتصحيح ومستوى إتقان طلابه',   'إجازة طالب تجاوز عدد الأخطاء المسموح بها', 3, 7),
  ('weak_second_recital',  4, 'ضبط المعلم',                'دقّته في التسميع والتصحيح ومستوى إتقان طلابه',   'ضعف إتقان الطالب عند تسميعه الثاني لدى المشرف', 4, 8),
  ('missed_mistake',       4, 'ضبط المعلم',                'دقّته في التسميع والتصحيح ومستوى إتقان طلابه',   'خطأ الطالب في التسميع دون أن ينتبه له المعلم ويردّه', 4, 9),
  ('program_unprepared',   5, 'الالتزام بالبرامج المصاحبة', null,                                             'عدم التحضير للبرنامج', 2, 10),
  ('program_unfollowed',   5, 'الالتزام بالبرامج المصاحبة', null,                                             'عدم متابعة البرنامج مع الطلاب عن كلّ مرّة', 2, 11),
  ('program_cancelled',    5, 'الالتزام بالبرامج المصاحبة', null,                                             'إلغاء البرنامج', 5, 12),
  ('admin_group_silent',   6, 'المتابعة الإلكترونية',       null,                                             'عدم التفاعل مع مجموعة الإدارة عن كلّ مرّة', 2, 13),
  ('student_group_lapse',  6, 'المتابعة الإلكترونية',       null,                                             'تقصير في مجموعة الطلاب (المطلوب 4 مرات أسبوعيّاً)', 2, 14);

-- ── أعمدة الزيارة ──
alter table public.supervision_visits
  add column deductions jsonb check (deductions is null or jsonb_typeof(deductions) = 'object'),
  add column criteria_scores smallint[],
  add column score smallint check (score between 0 and 42),
  add column locked_at timestamptz,
  add column teacher_ack_at timestamptz;

-- ── الحساب والإقفال ──
create or replace function private.visit_score_and_lock()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_unlock boolean := current_setting('torjoman.visit_unlock', true) is not distinct from coalesce(new.id, old.id)::text;
  v_ack boolean := current_setting('torjoman.visit_ack', true) is not distinct from coalesce(new.id, old.id)::text;
  v_scores smallint[];
begin
  -- الخدمةُ والهجرات تكتب كما تشاء (والحسابُ يجري لها أيضاً)
  if tg_op = 'DELETE' then
    if auth.uid() is not null and old.locked_at is not null and not public.is_admin_manager() then
      raise exception 'الزيارة مقفلة بعد حفظ نتيجتها — لا يحذفها إلا المدير الإداري.' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null then
    -- عمودا الإقفال والاطّلاع للمُشغِّل والدالّتين وحدها
    if not v_ack then new.teacher_ack_at := old.teacher_ack_at; end if;
    if v_unlock then
      new.locked_at := null;
      new.teacher_ack_at := null;
      return new;
    end if;
    if old.locked_at is not null then
      if (new.executed_at, new.deductions, new.notes, new.flow_rating, new.strengths, new.improvements,
          new.recommendations, new.scheduled_at, new.halaqa_id, new.supervisor_id)
         is distinct from
         (old.executed_at, old.deductions, old.notes, old.flow_rating, old.strengths, old.improvements,
          old.recommendations, old.scheduled_at, old.halaqa_id, old.supervisor_id) then
        raise exception 'الزيارة مقفلة بعد حفظ نتيجتها — يفتحها المدير الإداري أو الفنيّ للتعديل.' using errcode = '42501';
      end if;
      new.locked_at := old.locked_at;
      return new;
    end if;
  end if;

  -- المحصّلات: لكلّ معيارٍ max(0, 7 − Σ عدد المرّات × خصم المرّة)، والمجموعُ من 42
  if new.deductions is null then
    new.criteria_scores := null;
    new.score := null;
  else
    if exists (
      select 1 from jsonb_each(new.deductions) e
       where not exists (select 1 from public.visit_deduction_items i where i.key = e.key)
          or jsonb_typeof(e.value) <> 'number'
          or (e.value)::numeric <> trunc((e.value)::numeric)
          or (e.value)::numeric < 0 or (e.value)::numeric > 99
    ) then
      raise exception 'بنودُ الخصم: مفتاحٌ غير معروف أو عددٌ غير صحيح (0–99).' using errcode = '23514';
    end if;
    select array_agg(greatest(0, 7 - coalesce(d.total, 0))::smallint order by c.criterion)
      into v_scores
      from generate_series(1, 6) as c(criterion)
      left join (
        select i.criterion, sum(i.per_time * (e.value)::numeric)::int as total
          from jsonb_each(new.deductions) e
          join public.visit_deduction_items i on i.key = e.key
         group by i.criterion
      ) d on d.criterion = c.criterion;
    new.criteria_scores := v_scores;
    new.score := (select sum(x) from unnest(v_scores) x);
  end if;

  -- الإقفالُ عند حفظ النتيجة بالنموذج (يومُ التنفيذ + البنود)، ويُعاد الاطّلاعُ كلّما أُعيد الإقفال
  if auth.uid() is not null and new.executed_at is not null and new.deductions is not null then
    new.locked_at := now();
    new.teacher_ack_at := null;
  elsif tg_op = 'INSERT' then
    new.locked_at := null;
    new.teacher_ack_at := null;
  end if;
  return new;
end;
$function$;
revoke all on function private.visit_score_and_lock() from public, anon, authenticated;

create trigger supervision_visits_score_lock
  before insert or update or delete on public.supervision_visits
  for each row execute function private.visit_score_and_lock();

-- ── فتحُ الإقفال (المدير الإداري والفنيّ) ──
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
revoke all on function public.unlock_visit_result(uuid) from public, anon;
grant execute on function public.unlock_visit_result(uuid) to authenticated;

-- ── اطّلاعُ المعلم ──
create or replace function public.acknowledge_visit(p_visit uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform private.assert_session_writable();
  perform set_config('torjoman.visit_ack', p_visit::text, true);
  update public.supervision_visits v set teacher_ack_at = now()
   where v.id = p_visit and v.locked_at is not null and v.teacher_ack_at is null
     and exists (select 1 from public.halaqat h where h.id = v.halaqa_id and h.teacher_id = (select auth.uid()));
  perform set_config('torjoman.visit_ack', '', true);
  if not found and not exists (
    select 1 from public.supervision_visits v join public.halaqat h on h.id = v.halaqa_id
     where v.id = p_visit and v.teacher_ack_at is not null and h.teacher_id = (select auth.uid())
  ) then
    raise exception 'لا نتيجةَ زيارةٍ مقفلة لحلقتك بهذا الرقم.' using errcode = '42501';
  end if;
end;
$function$;
revoke all on function public.acknowledge_visit(uuid) from public, anon;
grant execute on function public.acknowledge_visit(uuid) to authenticated;

-- ── الإشعارات: نتيجةٌ للمعلم، وفتحٌ للمشرف، وتغييرُ موعدٍ للإدارة ──
alter table public.notifications drop constraint notifications_kind_check;
-- (طُبِّق بصيغة `kind = any (array[…])` المكافئة؛ ويُكتب هنا `kind in (…)` لأنّ notifications.test.ts يقرأ هذه الصيغة)
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled'
));

create or replace function private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  -- بلا مستلمٍ لا إشعار، ولا يُشعَر أحدٌ بفعله هو.
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;

  -- التحقّق نفسُه قيودُ الجدول، لكنّه هنا تحذيرٌ لا استثناء: القيدُ كان سيُسقط العمليةَ الأصلية.
  -- (قائمةُ الأنواع تطابق notifications_kind_check — تُحدَّث معه عند إضافة نوع.)
  if p_kind is null or p_kind not in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write',
    'statement_returned',
    'visit_result', 'visit_unlocked', 'visit_rescheduled'
  ) then
    raise warning 'notify: نوعٌ غير معروف %', p_kind;
    return;
  end if;
  if p_link is not null and p_link !~ '^/[A-Za-z0-9/_?=&-]*$' then
    raise warning 'notify: رابطٌ غير مسموح %', p_link;
    return;
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise warning 'notify: عنوانٌ فارغ (النوع %)', p_kind;
    return;
  end if;

  begin
    insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
    values (p_recipient, p_kind, left(btrim(p_title), 120), left(nullif(btrim(coalesce(p_body, '')), ''), 400), p_link, p_source_table, p_source_id);

    -- التقليمُ بعد الإدراج وبدفعةٍ محدودة: ما مضى عليه ثلاثة أشهر، وما أقفله غيرُنا يُترك لدورةٍ لاحقة.
    delete from public.notifications
     where id in (select id from public.notifications
                   where created_at < now() - interval '3 months'
                   order by created_at limit 200
                   for update skip locked);
  exception when others then
    raise warning 'notify failed: %', sqlerrm;
  end;
end;
$function$;

create or replace function private.notify_visit_changes()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_halaqa text;
  v_teacher uuid;
  v_sup text;
  v_reason text;
  v_to uuid;
begin
  select h.name, h.teacher_id into v_halaqa, v_teacher from public.halaqat h where h.id = new.halaqa_id;

  -- أُقفلت النتيجة الآن ← المعلم
  if new.locked_at is not null and old.locked_at is null then
    perform private.notify(v_teacher, 'visit_result', 'نتيجةُ زيارةٍ إشرافية لحلقتك',
      coalesce(v_halaqa, 'حلقة') || ' · ' || coalesce(new.score::text, '—') || ' من 42 — اطّلع عليها وأقِرّ',
      '/visits', 'supervision_visits', new.id);
  end if;

  -- تغيّر الموعد ← المدير الإداري والفنيّ (السببُ من سجلّ التغيير في المعاملة نفسها)
  if new.scheduled_at is distinct from old.scheduled_at then
    select p.full_name into v_sup from public.profiles p where p.id = new.supervisor_id;
    select l.reason into v_reason from public.visit_reschedule_log l
     where l.visit_id = new.id and l.new_time = new.scheduled_at order by l.changed_at desc limit 1;
    for v_to in select p.id from public.profiles p
                 where p.status = 'active' and p.role in ('admin_manager', 'technical_manager') loop
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
revoke all on function private.notify_visit_changes() from public, anon, authenticated;

create trigger supervision_visits_notify_changes
  after update on public.supervision_visits
  for each row execute function private.notify_visit_changes();

-- ── فحصٌ ذاتيّ ──
do $$
begin
  if (select count(*) from public.visit_deduction_items) <> 14 then
    raise exception 'بنودُ الخصم ليست 14';
  end if;
  if (select count(distinct criterion) from public.visit_deduction_items) <> 6 then
    raise exception 'المعاييرُ ليست ستّة';
  end if;
  if not has_function_privilege('authenticated', 'public.unlock_visit_result(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.acknowledge_visit(uuid)', 'execute') then
    raise exception 'منحُ الدالّتين ناقص';
  end if;
  if has_function_privilege('authenticated', 'private.visit_score_and_lock()', 'execute') then
    raise exception 'دالّةُ المُشغِّل ممنوحةٌ لـauthenticated';
  end if;
end $$;
