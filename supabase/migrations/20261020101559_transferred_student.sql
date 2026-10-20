-- الطالبُ المنقول (قرارات المستخدم 2026-10-20):
--   1) الطاقمُ الجديد يرى تاريخَ الطالب كلَّه للقراءة (الإنجاز القرآنيّ ورؤوس تقاريره، وبنود الترشيح وقوائمها)،
--      والقديمُ يبقى يرى ما في حلقته كما كان.
--   2) عند النقل يُسحب ترشيحُه غيرُ المرصود في قوائم حلقته القديمة (والقائمةُ إن فرغت)، والنتائجُ المرصودة لا تُمسّ.
--   3) عند النقل يُحذف رصدُه في مسوّدات حلقته القديمة؛ وما أُرسل (مُرسَلاً أو معتمَداً) يبقى ولا يُرصد الشهرُ مرّةً ثانية.
--
-- قراراتُ التنفيذ:
--   • سياستا quran_records_read وitems_select تُضاف إليهما «أو الطالبُ في حلقةٍ أراها الآن» بصيغة الموجز حرفياً.
--   • سياستا reports_select وlists_select لا تُكتبان بصيغة الموجز: المرجعُ المتبادل (التقرير ← السجلّات ← التقرير،
--     والقائمة ← البنود ← القائمة) يُسقط كلَّ قراءةٍ بـ42P17 «infinite recursion detected in policy» (جُرِّب في معاملةٍ
--     ملغاة 2026-10-20). البديل دالّتان security definer في private تُرجعان مصفوفةَ المعرّفات مرّةً واحدة لكلّ استعلام
--     (initplan) وتقتصران على صفوف «حلقةُ التقرير/القائمة غيرُ حلقة الطالب الحالية» — وما سواها يغطّيه الشرطُ القائم.
--   • لم يُعدَّل أيُّ حارسٍ قائم: guard_graded_item يأذن بحذف البند غير المرصود، وguard_quran_record يتجاوز الحذفَ
--     في عمق > 1، وexam_lists بلا مُشغّل حذف.

-- 1) دالّتا القراءة للتقرير والقائمة ------------------------------------------------------------------------

/** معرّفاتُ التقارير التي فيها سجلٌّ لطالبٍ نُقل منها إلى حلقةٍ يراها المستخدمُ الآن (رأسُ التقرير وحده). */
create or replace function private.transferred_report_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct q.report_id), '{}')
  from public.quran_records q
  join public.students s on s.id = q.student_id
  join public.monthly_reports r on r.id = q.report_id
  where r.halaqa_id is distinct from s.halaqa_id
    and s.halaqa_id = any (public.visible_halaqa_ids());
$$;

/** معرّفاتُ قوائم الاختبار التي فيها بندٌ لطالبٍ نُقل منها إلى حلقةٍ يراها المستخدمُ الآن. */
create or replace function private.transferred_exam_list_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct i.exam_list_id), '{}')
  from public.exam_list_items i
  join public.students s on s.id = i.student_id
  join public.exam_lists l on l.id = i.exam_list_id
  where l.halaqa_id is distinct from s.halaqa_id
    and s.halaqa_id = any (public.visible_halaqa_ids());
$$;

revoke all on function private.transferred_report_ids() from public, anon, authenticated;
revoke all on function private.transferred_exam_list_ids() from public, anon, authenticated;
grant execute on function private.transferred_report_ids() to authenticated, service_role;
grant execute on function private.transferred_exam_list_ids() to authenticated, service_role;

-- 2) سياساتُ القراءة (الكتابةُ لا تُمسّ) ---------------------------------------------------------------------

drop policy quran_records_read on public.quran_records;
create policy quran_records_read on public.quran_records
  for select to authenticated
  using (
    exists (select 1 from public.monthly_reports r
            where r.id = quran_records.report_id
              and r.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
    or exists (select 1 from public.students s
               where s.id = quran_records.student_id
                 and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
  );

drop policy reports_select on public.monthly_reports;
create policy reports_select on public.monthly_reports
  for select to authenticated
  using (
    halaqa_id = any ((select public.visible_halaqa_ids())::uuid[])
    or id = any ((select private.transferred_report_ids())::uuid[])
  );

drop policy items_select on public.exam_list_items;
create policy items_select on public.exam_list_items
  for select to authenticated
  using (
    exists (select 1 from public.exam_lists l
            where l.id = exam_list_items.exam_list_id
              and l.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
    or exists (select 1 from public.students s
               where s.id = exam_list_items.student_id
                 and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))
  );

drop policy lists_select on public.exam_lists;
create policy lists_select on public.exam_lists
  for select to authenticated
  using (
    halaqa_id = any ((select public.visible_halaqa_ids())::uuid[])
    or id = any ((select private.transferred_exam_list_ids())::uuid[])
  );

-- 3) المُشغِّلُ عند النقل -----------------------------------------------------------------------------------

/** عند نقل الطالب: يسحب ترشيحَه غيرَ المرصود في قوائم حلقته القديمة (والقائمةَ إن فرغت)، ويحذف رصدَه في مسوّداتها. */
create or replace function private.on_student_transfer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lists uuid[];
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
  delete from public.exam_lists l
   where l.id = any (v_lists)
     and not exists (select 1 from public.exam_list_items i where i.exam_list_id = l.id);

  -- رصدُه في مسوّدات الحلقة القديمة؛ المُرسَلُ والمعتمَدُ يبقيان.
  delete from public.quran_records q
   using public.monthly_reports r
   where r.id = q.report_id
     and r.halaqa_id = old.halaqa_id
     and r.status = 'draft'
     and q.student_id = new.id;

  return null;
end;
$$;

revoke all on function private.on_student_transfer() from public, anon, authenticated;

create trigger students_on_transfer
  after update of halaqa_id on public.students
  for each row
  when (old.halaqa_id is distinct from new.halaqa_id and old.halaqa_id is not null)
  execute function private.on_student_transfer();

-- 4) حارسُ الشهر المرصود في حلقةٍ أخرى -----------------------------------------------------------------------

/** يرفض رصدَ شهرٍ للطالب إن كان له سجلٌّ لهذا الشهر في تقريرٍ آخر أُرسل (مُرسَلاً أو معتمَداً). */
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

  if exists (
    select 1 from public.quran_records q
    join public.monthly_reports r on r.id = q.report_id
    where q.student_id = new.student_id
      and q.id <> new.id
      and r.id <> new.report_id
      and r.report_month = v_month
      and r.report_year = v_year
      and r.status <> 'draft'
  ) then
    raise exception 'رُصد هذا الشهرُ للطالب في حلقته السابقة.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_month_recorded_elsewhere() from public, anon, authenticated;

create trigger quran_records_guard_month_elsewhere
  before insert or update of student_id, report_id on public.quran_records
  for each row execute function private.guard_month_recorded_elsewhere();

-- 5) الفحصُ الذاتيّ ------------------------------------------------------------------------------------------
do $$
declare
  v_qual text;
begin
  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'quran_records' and policyname = 'quran_records_read'
     and cmd = 'SELECT' and roles = '{authenticated}';
  if v_qual is null or v_qual not like '%visible_halaqa_ids%' or v_qual not like '%students s%'
     or v_qual not like '%monthly_reports r%' then
    raise exception 'quran_records_read ناقصة: %', v_qual;
  end if;

  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'exam_list_items' and policyname = 'items_select'
     and cmd = 'SELECT' and roles = '{authenticated}';
  if v_qual is null or v_qual not like '%visible_halaqa_ids%' or v_qual not like '%students s%'
     or v_qual not like '%exam_lists l%' then
    raise exception 'items_select ناقصة: %', v_qual;
  end if;

  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'monthly_reports' and policyname = 'reports_select'
     and cmd = 'SELECT' and roles = '{authenticated}';
  if v_qual is null or v_qual not like '%visible_halaqa_ids%' or v_qual not like '%transferred_report_ids%' then
    raise exception 'reports_select ناقصة: %', v_qual;
  end if;

  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'exam_lists' and policyname = 'lists_select'
     and cmd = 'SELECT' and roles = '{authenticated}';
  if v_qual is null or v_qual not like '%visible_halaqa_ids%' or v_qual not like '%transferred_exam_list_ids%' then
    raise exception 'lists_select ناقصة: %', v_qual;
  end if;

  if not exists (select 1 from pg_trigger g
                 where not g.tgisinternal and g.tgname = 'students_on_transfer'
                   and g.tgrelid = 'public.students'::regclass and g.tgenabled = 'O'
                   and g.tgfoid = 'private.on_student_transfer()'::regprocedure) then
    raise exception 'مُشغّل students_on_transfer ناقص';
  end if;
  if not exists (select 1 from pg_trigger g
                 where not g.tgisinternal and g.tgname = 'quran_records_guard_month_elsewhere'
                   and g.tgrelid = 'public.quran_records'::regclass and g.tgenabled = 'O'
                   and g.tgfoid = 'private.guard_month_recorded_elsewhere()'::regprocedure) then
    raise exception 'مُشغّل quran_records_guard_month_elsewhere ناقص';
  end if;

  if has_function_privilege('authenticated', 'private.on_student_transfer()', 'execute')
     or has_function_privilege('anon', 'private.on_student_transfer()', 'execute')
     or has_function_privilege('authenticated', 'private.guard_month_recorded_elsewhere()', 'execute')
     or has_function_privilege('anon', 'private.guard_month_recorded_elsewhere()', 'execute') then
    raise exception 'دالّةُ مُشغّلٍ مكشوفةٌ للعميل';
  end if;
  -- دالّتا السياسة: authenticated يحتاجهما وإلا سقطت القراءةُ كلُّها؛ anon لا.
  if not (has_function_privilege('authenticated', 'private.transferred_report_ids()', 'execute')
          and has_function_privilege('authenticated', 'private.transferred_exam_list_ids()', 'execute')) then
    raise exception 'دالّتا السياسة بلا منحٍ لـauthenticated';
  end if;
  if has_function_privilege('anon', 'private.transferred_report_ids()', 'execute')
     or has_function_privilege('anon', 'private.transferred_exam_list_ids()', 'execute') then
    raise exception 'دالّتا السياسة مكشوفتان لـanon';
  end if;
end $$;
