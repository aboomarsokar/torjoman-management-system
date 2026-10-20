-- الطالبُ المنقول — جولةُ الإصلاح الأولى (مراجعة 2026-10-20) فوق 20261020101559_transferred_student:
--   1) حارسُ الشهر يمنع بأيّ حالة: سجلٌّ للطالب في تقريرٍ آخر للشهر نفسه — ولو مسوّدةً أُعيدت بعد النقل — يكفي.
--   2) results_select: الحلقةُ القديمة (مختبِرُها ومعلّمُها) ترى النتائجَ المرصودة في قوائمها بعد نقل الطالب،
--      فلا يعود البندُ المرصود «بانتظار الرصد» في الجرس وطابور الرصد (ضمٌّ عكسيّ على exam_results).
--   3) المُشغِّلُ عند النقل يحذف من مسوّدات الحلقة القديمة شهرَ النقل وما بعده وحده (الشهرُ الجاري بتوقيت غزّة)؛
--      مسوّداتُ ما قبله تبقى لمعلّمها القديم.
--   4) القائمةُ التي فرغت فحُذفت تُحذف معها إشعاراتُ exam_nominated غيرُ المقروءة التي تشير إليها.
--   5) الفحصُ الذاتيّ يتحقّق من security definer وsearch_path='' لدوالّ الطالب المنقول الأربع.

-- 1) حارسُ الشهر ------------------------------------------------------------------------------------------

/** يرفض رصدَ شهرٍ للطالب إن كان له سجلٌّ لهذا الشهر في تقريرٍ آخر بأيّ حالة (رُصد في حلقته السابقة). */
create or replace function private.guard_month_recorded_elsewhere()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month integer;
  v_year integer;
begin
  if tg_op = 'UPDATE'
     and new.student_id is not distinct from old.student_id
     and new.report_id is not distinct from old.report_id then
    return new;
  end if;

  select r.report_month, r.report_year into v_month, v_year
    from public.monthly_reports r where r.id = new.report_id;

  -- أيُّ حالة: المسوّدةُ القديمة التي بقيت (شهرٌ سابق للنقل) أو أُعيدت بعده تحجب كالمُرسَل.
  if exists (
    select 1 from public.quran_records q
    join public.monthly_reports r on r.id = q.report_id
    where q.student_id = new.student_id
      and q.id <> new.id
      and r.id <> new.report_id
      and r.report_month = v_month
      and r.report_year = v_year
  ) then
    raise exception 'رُصد هذا الشهرُ للطالب في حلقته السابقة.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_month_recorded_elsewhere() from public, anon, authenticated;

-- 2) نتائجُ الحلقة القديمة -----------------------------------------------------------------------------------

drop policy results_select on public.exam_results;
create policy results_select on public.exam_results
  for select to authenticated
  using (
    (student_id = public.my_student_id())
    or exists (select 1 from public.students s
               where s.id = exam_results.student_id
                 and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
    or exists (select 1 from public.exam_list_items i
               join public.exam_lists l on l.id = i.exam_list_id
               where i.id = exam_results.exam_list_item_id
                 and l.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
  );

-- 3) و4) المُشغِّلُ عند النقل ---------------------------------------------------------------------------------

/**
 * عند نقل الطالب: يسحب ترشيحَه غيرَ المرصود في قوائم حلقته القديمة (والقائمةَ إن فرغت مع إشعار ترشيحها غيرِ المقروء)،
 * ويحذف رصدَه في مسوّداتها لشهر النقل وما بعده (بتوقيت غزّة).
 */
create or replace function private.on_student_transfer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lists uuid[];
  v_emptied uuid[];
  v_today date := private.attendance_today();
begin
  -- البنودُ بلا نتيجة؛ المرصودُ يبقى في قائمته القديمة.
  with gone as (
    delete from public.exam_list_items i
     using public.exam_lists l
     where l.id = i.exam_list_id
       and l.halaqa_id = old.halaqa_id
       and i.student_id = new.id
       and not exists (select 1 from public.exam_results r where r.exam_list_item_id = i.id)
    returning i.exam_list_id
  )
  select coalesce(array_agg(distinct g.exam_list_id), '{}') into v_lists from gone g;

  -- بيانٌ مستقلّ: الـCTE لا يرى حذفَه، فالفراغُ يُفحص بعده.
  with emptied as (
    delete from public.exam_lists l
     where l.id = any (v_lists)
       and not exists (select 1 from public.exam_list_items i where i.exam_list_id = l.id)
    returning l.id
  )
  select coalesce(array_agg(e.id), '{}') into v_emptied from emptied e;

  -- إشعارُ الترشيح يشير إلى القائمة (مصدرُه exam_lists)؛ غيرُ المقروء منه لقائمةٍ زالت يُحذف.
  delete from public.notifications n
   where n.kind = 'exam_nominated'
     and n.source_table = 'exam_lists'
     and n.source_id = any (v_emptied)
     and n.read_at is null;

  -- رصدُه في مسوّدات الحلقة القديمة لشهر النقل وما بعده؛ ما قبله والمُرسَلُ والمعتمَدُ تبقى.
  delete from public.quran_records q
   using public.monthly_reports r
   where r.id = q.report_id
     and r.halaqa_id = old.halaqa_id
     and r.status = 'draft'
     and (r.report_year, r.report_month)
         >= (extract(year from v_today)::integer, extract(month from v_today)::integer)
     and q.student_id = new.id;

  return null;
end;
$$;

revoke all on function private.on_student_transfer() from public, anon, authenticated;

-- 5) الفحصُ الذاتيّ ------------------------------------------------------------------------------------------
do $$
declare
  v_qual text;
  v_fn text;
begin
  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'exam_results' and policyname = 'results_select'
     and cmd = 'SELECT' and roles = '{authenticated}';
  if v_qual is null or v_qual not like '%my_student_id()%' or v_qual not like '%students s%'
     or v_qual not like '%exam_list_items i%' or v_qual not like '%exam_lists l%'
     or v_qual not like '%visible_halaqa_ids%' then
    raise exception 'results_select ناقصة: %', v_qual;
  end if;

  if pg_get_functiondef('private.guard_month_recorded_elsewhere()'::regprocedure) like '%status%' then
    raise exception 'حارسُ الشهر ما زال يفحص الحالة';
  end if;
  if pg_get_functiondef('private.on_student_transfer()'::regprocedure) not like '%attendance_today()%'
     or pg_get_functiondef('private.on_student_transfer()'::regprocedure) not like '%exam_nominated%' then
    raise exception 'on_student_transfer بلا قيد شهر النقل أو بلا حذف الإشعار';
  end if;

  foreach v_fn in array array['private.transferred_report_ids()', 'private.transferred_exam_list_ids()',
                              'private.on_student_transfer()', 'private.guard_month_recorded_elsewhere()'] loop
    if not exists (select 1 from pg_proc p
                   where p.oid = v_fn::regprocedure and p.prosecdef
                     and p.proconfig @> array['search_path=""']) then
      raise exception '% ليست security definer بـsearch_path فارغ', v_fn;
    end if;
  end loop;

  if has_function_privilege('authenticated', 'private.on_student_transfer()', 'execute')
     or has_function_privilege('anon', 'private.on_student_transfer()', 'execute')
     or has_function_privilege('authenticated', 'private.guard_month_recorded_elsewhere()', 'execute')
     or has_function_privilege('anon', 'private.guard_month_recorded_elsewhere()', 'execute') then
    raise exception 'دالّةُ مُشغّلٍ مكشوفةٌ للعميل';
  end if;

  if not exists (select 1 from pg_trigger g
                 where not g.tgisinternal and g.tgname = 'students_on_transfer' and g.tgenabled = 'O'
                   and g.tgfoid = 'private.on_student_transfer()'::regprocedure)
     or not exists (select 1 from pg_trigger g
                    where not g.tgisinternal and g.tgname = 'quran_records_guard_month_elsewhere' and g.tgenabled = 'O'
                      and g.tgfoid = 'private.guard_month_recorded_elsewhere()'::regprocedure) then
    raise exception 'مُشغّلا الطالب المنقول ناقصان';
  end if;
end $$;
