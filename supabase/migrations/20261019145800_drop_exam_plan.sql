-- ============================================================
-- حذفُ خطة الاختبارات القديمة (الجزء ٣ — المهمة 8، بإذن المستخدم 2026-10-19)
-- الواجهةُ المنشورة (main 9fd229c) لا تقرأ exam_plan، وجداولُ الاختبار فارغة (لا بندَ بلا دورة).
-- يُحذف: حارسُ ترتيب المحطات ودالّته، وعمودُ exam_plan_id، وجدولُ exam_plan ونوعُه، ودالّةُ my_exam_results،
-- وفرعُ exam_plan في bump_parts_on_pass؛ ويصير exam_cycle_id إلزامياً.
-- ============================================================

-- ١) لا بندَ بلا دورة — وإلا توقّف (بندٌ من واجهةٍ قديمةٍ محفوظةٍ في متصفّح)
do $$
begin
  if exists (select 1 from public.exam_list_items where exam_cycle_id is null) then
    raise exception 'بنودُ ترشيحٍ بلا دورة ما زالت قائمة — لا يُحذف النموذجُ القديم';
  end if;
end $$;

-- ٢) رفعُ الأجزاء بالدورة وحدها
create or replace function public.bump_parts_on_pass()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_parts int;
begin
  if not new.passed or new.exam_list_item_id is null then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.passed, false) then return new; end if;

  -- أجزاءُ الدورة المحقَّقة بالاجتياز: من الناس حتى بداية الدورة
  select 31 - c.parts_from into v_parts
  from public.exam_list_items i
  join public.exam_cycles c on c.id = i.exam_cycle_id
  where i.id = new.exam_list_item_id;

  if v_parts is not null then
    update public.students
       set quran_parts = v_parts
     where id = new.student_id and coalesce(quran_parts, 0) < v_parts;
  end if;
  return new;
end;
$function$;

-- ٣) الحارسُ القديم ودالّتُه، والعمود، والجدول ونوعُه، ودالّةُ نتائج الطالب القديمة
drop trigger if exists exam_list_items_guard_sequence on public.exam_list_items;
drop function if exists public.guard_station_sequence();
drop function if exists public.my_exam_results();
alter table public.exam_list_items drop column if exists exam_plan_id;
drop table if exists public.exam_plan;
drop type if exists public.exam_stage_type;

-- ٤) كلُّ ترشيحٍ لدورة
alter table public.exam_list_items alter column exam_cycle_id set not null;

-- ٥) فحصٌ ذاتيّ: لا أثرَ للنموذج القديم
do $$
begin
  if to_regclass('public.exam_plan') is not null
     or to_regtype('public.exam_stage_type') is not null
     or to_regprocedure('public.my_exam_results()') is not null
     or to_regprocedure('public.guard_station_sequence()') is not null then
    raise exception 'بقي من النموذج القديم شيء';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'exam_list_items' and column_name = 'exam_plan_id') then
    raise exception 'عمودُ exam_plan_id باقٍ';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'exam_list_items'
               and column_name = 'exam_cycle_id' and is_nullable = 'YES') then
    raise exception 'exam_cycle_id ما زال يقبل الفراغ';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname in ('public', 'private') and p.prokind = 'f'
               and pg_get_functiondef(p.oid) ~ 'exam_plan|exam_stage_type') then
    raise exception 'دالّةٌ ما زالت تشير إلى exam_plan';
  end if;
  if exists (select 1 from pg_views where schemaname in ('public', 'private') and definition ~ 'exam_plan') then
    raise exception 'عرضٌ ما زال يشير إلى exam_plan';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'exam_results_bump_parts' and not tgisinternal) then
    raise exception 'مُشغِّلُ رفع الأجزاء مفقود';
  end if;
end $$;
