-- الاختبارات المرحلية (الجزء ٣ — المهمة ١، 2026-10-19):
-- جدولُ الدورات الخمس عشرة (3 مراحل × 5 دورات) من الناس صعوداً، وحارسُ ترتيبها، ورفعُ الأجزاء،
-- ومنتِجا الإشعار exam_nominated / exam_graded، ودالّةُ نتائج الطالب نفسه.
-- إضافيّةٌ كلّها: البنودُ القديمة (exam_plan_id) تبقى بحارسها القديم guard_station_sequence وبرفعها القديم.
-- الدلالات: program_juz مرقّمٌ بترتيب الحفظ (30 = الناس)، فعددُ أجزاء الدورة المحقَّق بالاجتياز = 31 − parts_from.

-- 1) الجدول ----------------------------------------------------------------------------------------
create table public.exam_cycles (
  id            smallint primary key,
  stage_number  smallint not null check (stage_number between 1 and 3),
  cycle_number  smallint not null check (cycle_number between 1 and 5),
  parts_from    smallint not null,
  parts_to      smallint not null,
  surahs_label  text not null check (btrim(surahs_label) <> ''),
  sort_order    smallint generated always as (((stage_number - 1) * 5 + cycle_number)::smallint) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint exam_cycles_stage_cycle_key unique (stage_number, cycle_number),
  constraint exam_cycles_sort_order_key unique (sort_order),
  constraint exam_cycles_parts_check check (1 <= parts_from and parts_from <= parts_to and parts_to <= 30)
);
comment on table public.exam_cycles is 'دوراتُ الاختبار المرحلية: 15 دورةً ثابتة العدد؛ يعدّل المديرُ الأجزاءَ والتسمية وحدها.';

alter table public.exam_cycles enable row level security;
revoke all on public.exam_cycles from public, anon, authenticated;
grant select on public.exam_cycles to authenticated;
grant update (parts_from, parts_to, surahs_label) on public.exam_cycles to authenticated;

create policy exam_cycles_select on public.exam_cycles for select to authenticated using (true);
create policy exam_cycles_update on public.exam_cycles for update to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));

create trigger trg_exam_cycles_updated_at before update on public.exam_cycles
  for each row execute function public.set_updated_at();

-- التعديلُ يمسّ الأجزاءَ والتسمية وحدها (حزامٌ فوق منحِ الأعمدة).
create or replace function private.guard_exam_cycle_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id
     or new.stage_number is distinct from old.stage_number
     or new.cycle_number is distinct from old.cycle_number then
    raise exception 'لا تُغيَّر مرحلةُ الدورة ولا رقمُها؛ تُعدَّل الأجزاءُ والتسميةُ وحدها.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger exam_cycles_guard_edit before update on public.exam_cycles
  for each row execute function private.guard_exam_cycle_edit();

-- 2) البذرة (صورة المستخدم؛ والدورة 3/3 «البقرة – النساء» بقرار المواصفة) ---------------------------
insert into public.exam_cycles (id, stage_number, cycle_number, parts_from, parts_to, surahs_label) values
  (1,1,1,28,30,'المجادلة – الناس'),(2,1,2,26,30,'الأحقاف – الناس'),(3,1,3,23,25,'يس – الجاثية'),
  (4,1,4,21,25,'العنكبوت – الجاثية'),(5,1,5,21,30,'العنكبوت – الناس'),
  (6,2,1,18,20,'المؤمنون – القصص'),(7,2,2,16,20,'مريم – القصص'),(8,2,3,13,15,'يوسف – الكهف'),
  (9,2,4,11,15,'يونس – الكهف'),(10,2,5,11,20,'يونس – القصص'),
  (11,3,1,8,10,'الأعراف – التوبة'),(12,3,2,6,10,'المائدة – التوبة'),(13,3,3,3,5,'البقرة – النساء'),
  (14,3,4,1,5,'البقرة – النساء'),(15,3,5,1,10,'البقرة – التوبة');

-- 3) ربطُ البنود بالدورة (فارغٌ للبنود القديمة) -----------------------------------------------------
alter table public.exam_list_items
  add column exam_cycle_id smallint references public.exam_cycles (id) on delete restrict;
create index idx_exam_list_items_cycle on public.exam_list_items (exam_cycle_id);
create index if not exists idx_exam_list_items_student on public.exam_list_items (student_id);
create index if not exists idx_exam_results_item on public.exam_results (exam_list_item_id);

-- 4) حارسُ الترتيب ---------------------------------------------------------------------------------
create or replace function private.guard_cycle_sequence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_due record;
begin
  if new.exam_cycle_id is null then return new; end if;
  if pg_trigger_depth() > 1 then return new; end if;  -- تتابعٌ من مُشغّلٍ آخر لا من العميل
  if tg_op = 'UPDATE'
     and new.exam_cycle_id is not distinct from old.exam_cycle_id
     and new.student_id is not distinct from old.student_id then
    return new;
  end if;

  -- تسلسلُ ترشيحات الطالب الواحد (يمنع سباقَ ترشيحين متزامنين)
  perform pg_advisory_xact_lock(hashtextextended('exam_cycle:' || new.student_id::text, 0));

  if exists (
    select 1 from public.exam_list_items li
    where li.student_id = new.student_id and li.exam_cycle_id is not null and li.id <> new.id
      and not exists (select 1 from public.exam_results er where er.exam_list_item_id = li.id)
  ) then
    raise exception 'للطالب ترشيحٌ بانتظار الرصد؛ لا يُرشَّح لدورةٍ أخرى قبل رصد نتيجته.' using errcode = '23514';
  end if;

  select c.id, c.stage_number, c.cycle_number into v_due
  from public.exam_cycles c
  where not exists (
    select 1 from public.exam_list_items li
    join public.exam_results er on er.exam_list_item_id = li.id
    where li.student_id = new.student_id and li.exam_cycle_id = c.id and li.id <> new.id and er.passed)
  order by c.sort_order
  limit 1;

  if not found then
    raise exception 'أتمّ الطالب الخطة؛ لا دورةَ مستحقّةً له.' using errcode = '23514';
  end if;
  if v_due.id <> new.exam_cycle_id then
    raise exception 'الدورةُ المستحقّة للطالب: المرحلة % · الدورة %.', v_due.stage_number, v_due.cycle_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger exam_list_items_guard_cycle
  before insert or update of exam_cycle_id, student_id on public.exam_list_items
  for each row execute function private.guard_cycle_sequence();

-- 5) رفعُ الأجزاء: للبند بدورةٍ 31 − parts_from، وإلا السلوكُ القديم (exam_plan.parts_to) كما هو.
--    ويُضاف مُشغّلُ تحديثٍ يلتقط الانتقال إلى «ناجح» (رصدٌ يُصحَّح لاحقاً) لبنود الدورات وحدها. لا يُنقِص أبداً.
create or replace function public.bump_parts_on_pass()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_parts int;
  v_cycle smallint;
begin
  if not new.passed or new.exam_list_item_id is null then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.passed, false) then return new; end if;

  select i.exam_cycle_id into v_cycle from public.exam_list_items i where i.id = new.exam_list_item_id;

  if v_cycle is not null then
    select 31 - c.parts_from into v_parts from public.exam_cycles c where c.id = v_cycle;
  elsif tg_op = 'INSERT' then
    select p.parts_to into v_parts
    from public.exam_list_items i join public.exam_plan p on p.id = i.exam_plan_id
    where i.id = new.exam_list_item_id;
  end if;

  if v_parts is not null then
    update public.students
       set quran_parts = v_parts
     where id = new.student_id and coalesce(quran_parts, 0) < v_parts;
  end if;
  return new;
end;
$$;

create trigger exam_results_bump_parts_on_update
  after update on public.exam_results
  for each row when (new.passed and not old.passed)
  execute function public.bump_parts_on_pass();

-- 6) المنتِجان (private.notify وحدها) ---------------------------------------------------------------
-- exam_nominated: على مستوى الجملة — إشعارٌ واحد لكلّ قائمة لا لكلّ طالب.
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
      r.halaqa_name || ' · ' || r.n || ' طالباً', '/exams', 'exam_lists', r.exam_list_id);
  end loop;
  return null;
end;
$$;
create trigger exam_list_items_notify_nominated
  after insert on public.exam_list_items
  referencing new table as new_items
  for each statement execute function private.notify_exam_nominated();

-- exam_graded: لمعلّم حلقة الطالب وللطالب نفسه.
create or replace function private.notify_exam_graded()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_teacher uuid;
  v_user uuid;
  v_verdict text := case when new.passed then 'ناجح' else 'راسب' end;
begin
  select s.full_name, h.teacher_id, s.user_id into v_name, v_teacher, v_user
  from public.students s left join public.halaqat h on h.id = s.halaqa_id
  where s.id = new.student_id;

  perform private.notify(v_teacher, 'exam_graded', 'رُصدت نتيجةُ اختبار',
    v_name || ' · ' || v_verdict || ' · ' || new.total_score, '/exams', 'exam_results', new.id);
  perform private.notify(v_user, 'exam_graded', 'رُصدت نتيجةُ اختبار',
    'نتيجتُك: ' || v_verdict || ' · ' || new.total_score, '/me', 'exam_results', new.id);
  return null;
end;
$$;
create trigger exam_results_notify_graded
  after insert on public.exam_results
  for each row execute function private.notify_exam_graded();

revoke all on function private.guard_exam_cycle_edit(), private.guard_cycle_sequence(),
  private.notify_exam_nominated(), private.notify_exam_graded() from public, anon, authenticated;

-- 7) نتائجُ الطالب نفسه بحسب الدورة ------------------------------------------------------------------
create or replace function public.my_exam_cycle_results()
returns table (exam_cycle_id smallint, passed boolean, total_score int, exam_date date)
language sql stable security definer set search_path = '' as $$
  select li.exam_cycle_id, er.passed, er.total_score, er.exam_date
  from public.exam_results er
  join public.exam_list_items li on li.id = er.exam_list_item_id
  where li.exam_cycle_id is not null
    and er.student_id = (select s.id from public.students s where s.user_id = (select auth.uid()))
  order by li.exam_cycle_id, er.exam_date, er.created_at;
$$;
revoke all on function public.my_exam_cycle_results() from public, anon;
grant execute on function public.my_exam_cycle_results() to authenticated;

-- 8) الفحصُ الذاتيّ ---------------------------------------------------------------------------------
do $$
declare
  v_sorts int[];
begin
  if (select count(*) from public.exam_cycles) <> 15 then raise exception 'exam_cycles: العدد ليس 15'; end if;
  select array_agg(sort_order order by sort_order) into v_sorts from public.exam_cycles;
  if v_sorts <> array(select generate_series(1, 15)) then raise exception 'exam_cycles: sort_order غير متّصل'; end if;
  -- المراحلُ تغطّي 30 ← 1 بالدورة الخامسة لكلّ مرحلة (28–30 ثم … ثم 1–10 مع 11–20 و21–30)
  if (select min(parts_from) from public.exam_cycles) <> 1 or (select max(parts_to) from public.exam_cycles) <> 30 then
    raise exception 'exam_cycles: المدى لا يغطّي 1–30';
  end if;
  if exists (select 1 from (select stage_number, min(parts_from) f, max(parts_to) t from public.exam_cycles group by 1) x
             where (stage_number, f, t) not in ((1,21,30),(2,11,20),(3,1,10))) then
    raise exception 'exam_cycles: تغطيةُ المراحل غير صحيحة';
  end if;
  if has_table_privilege('anon', 'public.exam_cycles', 'select')
     or has_table_privilege('authenticated', 'public.exam_cycles', 'insert')
     or has_table_privilege('authenticated', 'public.exam_cycles', 'delete')
     or not has_table_privilege('authenticated', 'public.exam_cycles', 'select')
     or not has_any_column_privilege('authenticated', 'public.exam_cycles', 'update') then
    raise exception 'exam_cycles: المنحُ خاطئة';
  end if;
  if has_column_privilege('authenticated', 'public.exam_cycles', 'stage_number', 'update')
     or not has_column_privilege('authenticated', 'public.exam_cycles', 'parts_from', 'update') then
    raise exception 'exam_cycles: منحُ الأعمدة خاطئ';
  end if;
  if has_function_privilege('authenticated', 'private.guard_cycle_sequence()', 'execute')
     or has_function_privilege('authenticated', 'private.notify_exam_nominated()', 'execute')
     or has_function_privilege('authenticated', 'private.notify_exam_graded()', 'execute') then
    raise exception 'دوالّ private مكشوفةٌ للعميل';
  end if;
  if has_function_privilege('anon', 'public.my_exam_cycle_results()', 'execute')
     or not has_function_privilege('authenticated', 'public.my_exam_cycle_results()', 'execute') then
    raise exception 'my_exam_cycle_results: المنحُ خاطئة';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal and tgname in (
        'exam_list_items_guard_cycle', 'exam_list_items_guard_sequence', 'exam_list_items_notify_nominated',
        'exam_results_bump_parts', 'exam_results_bump_parts_on_update', 'exam_results_notify_graded',
        'exam_cycles_guard_edit', 'trg_exam_cycles_updated_at')) <> 8 then
    raise exception 'المُشغّلات ناقصة';
  end if;
  if pg_get_functiondef('public.bump_parts_on_pass()'::regprocedure) not like '%exam_cycles%'
     or pg_get_functiondef('public.bump_parts_on_pass()'::regprocedure) not like '%exam_plan%' then
    raise exception 'bump_parts_on_pass: الدالّة لا تجمع المسارين';
  end if;
end $$;
