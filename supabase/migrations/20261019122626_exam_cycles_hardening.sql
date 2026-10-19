-- تحصينُ تاريخ الدورات (مراجعة المهمة 1، الجولة 1، 2026-10-19):
-- (1) لا يُمحى ترشيحٌ رُصدت نتيجته ولا تُغيَّر دورتُه ولا طالبُه، وإلا تراجعت «الدورةُ المستحقّة» بصمت؛
-- (2) نتيجةٌ واحدةٌ لكلّ ترشيح، ولا تُنقل نتيجةٌ إلى ترشيحٍ أو طالبٍ آخر؛
-- (3) تعديلُ المدير للدورات يُعاد فحصُ اتّساقه (الثانية تحوي الأولى، الرابعة تحوي الثالثة، الخامسةُ تحوي الأربع)؛
-- (6) صياغةُ الإشعارات بجنس الطالب. البنودُ القديمة (exam_plan_id) تخضع للحارس نفسه متى رُصدت نتيجتُها.

-- 1) ترشيحٌ مرصود لا يُحذف ولا يُنقل -----------------------------------------------------------------
-- الحذفُ المتتالي من حذف الطالب نفسه مسموح (التاريخُ يزول بزوال صاحبه)؛ وحذفُ قائمةٍ فيها مرصودٌ ممنوع.
create or replace function private.guard_graded_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.exam_results er where er.exam_list_item_id = old.id) then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if not exists (select 1 from public.students s where s.id = old.student_id) then
      return old;
    end if;
    raise exception 'لا يُحذف ترشيحٌ رُصدت نتيجته.' using errcode = '23514';
  end if;

  if new.exam_cycle_id is distinct from old.exam_cycle_id
     or new.student_id is distinct from old.student_id then
    raise exception 'لا تُغيَّر دورةُ ترشيحٍ مرصود.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger exam_list_items_guard_graded
  before update or delete on public.exam_list_items
  for each row execute function private.guard_graded_item();

-- 2) نتيجةٌ واحدة لكلّ ترشيح، ولا تُنقل ---------------------------------------------------------------
drop index if exists public.idx_exam_results_item;
create unique index uq_exam_results_item on public.exam_results (exam_list_item_id);

create or replace function private.guard_result_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.student_id is distinct from old.student_id then
    raise exception 'لا تُنقل نتيجةٌ إلى ترشيحٍ آخر.' using errcode = '23514';
  end if;
  if old.exam_list_item_id is not null and new.exam_list_item_id is distinct from old.exam_list_item_id then
    -- المفتاحُ الأجنبيّ (on delete set null) حين يزول الترشيح نفسه مسموح؛ ما عداه ممنوع.
    if new.exam_list_item_id is null
       and not exists (select 1 from public.exam_list_items i where i.id = old.exam_list_item_id) then
      return new;
    end if;
    raise exception 'لا تُنقل نتيجةٌ إلى ترشيحٍ آخر.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger exam_results_guard_link
  before update on public.exam_results
  for each row execute function private.guard_result_link();

-- 3) اتّساقُ الدورات بعد كلّ تعديل (مؤجَّلٌ إلى نهاية المعاملة كي يمرّ تعديلُ عدّة دوراتٍ معاً) --------
create or replace function private.check_exam_cycles_consistency()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v record;
begin
  select hi.stage_number, hi.cycle_number as hi_c, lo.cycle_number as lo_c into v
  from public.exam_cycles hi
  join public.exam_cycles lo on lo.stage_number = hi.stage_number
   and ((hi.cycle_number = 2 and lo.cycle_number = 1)
     or (hi.cycle_number = 4 and lo.cycle_number = 3)
     or (hi.cycle_number = 5 and lo.cycle_number in (1, 2, 3, 4)))
  where hi.parts_from > lo.parts_from or hi.parts_to < lo.parts_to
  order by hi.stage_number, hi.cycle_number, lo.cycle_number
  limit 1;

  if found then
    raise exception 'المرحلة %: نطاقُ الدورة % يجب أن يشمل نطاقَ الدورة %.', v.stage_number, v.hi_c, v.lo_c
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger exam_cycles_consistency
  after update on public.exam_cycles
  deferrable initially deferred
  for each row execute function private.check_exam_cycles_consistency();

-- 6) صياغةٌ بجنس الطالب ----------------------------------------------------------------------------
create or replace function private.notify_exam_nominated()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select n.exam_list_id, count(*) as n, h.name as halaqa_name, h.examiner_id
    from new_items n
    join public.exam_lists l on l.id = n.exam_list_id
    join public.halaqat h on h.id = l.halaqa_id
    group by n.exam_list_id, h.name, h.examiner_id
  loop
    perform private.notify(r.examiner_id, 'exam_nominated', 'ترشيحٌ جديد للاختبار',
      r.halaqa_name || ' · عدد المرشّحين: ' || r.n, '/exams', 'exam_lists', r.exam_list_id);
  end loop;
  return null;
end;
$$;

create or replace function private.notify_exam_graded()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_teacher uuid;
  v_user uuid;
  v_female boolean;
  v_verdict text;
begin
  select s.full_name, h.teacher_id, s.user_id, s.gender::text = 'female'
    into v_name, v_teacher, v_user, v_female
  from public.students s left join public.halaqat h on h.id = s.halaqa_id
  where s.id = new.student_id;

  v_verdict := case when new.passed then (case when coalesce(v_female, false) then 'ناجحة' else 'ناجح' end)
                    else (case when coalesce(v_female, false) then 'راسبة' else 'راسب' end) end;

  perform private.notify(v_teacher, 'exam_graded', 'رُصدت نتيجةُ اختبار',
    v_name || ' · ' || v_verdict || ' · المجموع ' || new.total_score, '/exams', 'exam_results', new.id);
  perform private.notify(v_user, 'exam_graded', 'رُصدت نتيجةُ اختبار',
    'نتيجتُك: ' || v_verdict || ' · المجموع ' || new.total_score, '/me', 'exam_results', new.id);
  return null;
end;
$$;

revoke all on function private.guard_graded_item(), private.guard_result_link(),
  private.check_exam_cycles_consistency(), private.notify_exam_nominated(), private.notify_exam_graded()
  from public, anon, authenticated;

-- 8) الفحصُ الذاتيّ ---------------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  -- كلُّ مُشغّلٍ على جدوله المقصود
  select string_agg(e.t, ', ') into v_missing
  from (values
    ('exam_cycles', 'exam_cycles_guard_edit'), ('exam_cycles', 'trg_exam_cycles_updated_at'),
    ('exam_cycles', 'exam_cycles_consistency'),
    ('exam_list_items', 'exam_list_items_guard_cycle'), ('exam_list_items', 'exam_list_items_guard_sequence'),
    ('exam_list_items', 'exam_list_items_guard_graded'), ('exam_list_items', 'exam_list_items_notify_nominated'),
    ('exam_results', 'exam_results_bump_parts'), ('exam_results', 'exam_results_bump_parts_on_update'),
    ('exam_results', 'exam_results_guard_link'), ('exam_results', 'exam_results_notify_graded')
  ) as e(tbl, t)
  where not exists (select 1 from pg_trigger g
                    where not g.tgisinternal and g.tgname = e.t and g.tgrelid = ('public.' || e.tbl)::regclass and g.tgenabled = 'O');
  if v_missing is not null then raise exception 'مُشغّلاتٌ ناقصة أو على جدولٍ خاطئ: %', v_missing; end if;

  if not (select relrowsecurity from pg_class where oid = 'public.exam_cycles'::regclass) then
    raise exception 'exam_cycles: RLS غير مفعّل';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'exam_cycles'
        and policyname in ('exam_cycles_select', 'exam_cycles_update')) <> 2 then
    raise exception 'exam_cycles: السياستان ناقصتان';
  end if;
  if not exists (select 1 from pg_index where indexrelid = 'public.uq_exam_results_item'::regclass and indisunique) then
    raise exception 'uq_exam_results_item: ليس فريداً';
  end if;
  if to_regclass('public.idx_exam_results_item') is not null then
    raise exception 'idx_exam_results_item: ما زال قائماً';
  end if;

  if has_function_privilege('authenticated', 'private.guard_graded_item()', 'execute')
     or has_function_privilege('authenticated', 'private.guard_result_link()', 'execute')
     or has_function_privilege('authenticated', 'private.check_exam_cycles_consistency()', 'execute')
     or has_function_privilege('anon', 'private.notify_exam_graded()', 'execute') then
    raise exception 'دوالّ private مكشوفةٌ للعميل';
  end if;
  if has_function_privilege('anon', 'public.my_exam_cycle_results()', 'execute')
     or not has_function_privilege('authenticated', 'public.my_exam_cycle_results()', 'execute') then
    raise exception 'my_exam_cycle_results: المنحُ خاطئة';
  end if;
  if pg_get_functiondef('private.notify_exam_graded()'::regprocedure) not like '%ناجحة%'
     or pg_get_functiondef('private.notify_exam_nominated()'::regprocedure) not like '%عدد المرشّحين%' then
    raise exception 'صياغةُ الإشعارات لم تُحدَّث';
  end if;
  -- بيانات الدورات الحاليّة متّسقةٌ مع القاعدة الجديدة
  if exists (select 1 from public.exam_cycles hi join public.exam_cycles lo on lo.stage_number = hi.stage_number
             and ((hi.cycle_number = 2 and lo.cycle_number = 1) or (hi.cycle_number = 4 and lo.cycle_number = 3)
               or (hi.cycle_number = 5 and lo.cycle_number in (1, 2, 3, 4)))
             where hi.parts_from > lo.parts_from or hi.parts_to < lo.parts_to) then
    raise exception 'البذرةُ تخالف قاعدةَ الاتّساق';
  end if;
end $$;
