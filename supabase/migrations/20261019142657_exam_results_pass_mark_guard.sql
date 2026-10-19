-- علامةُ الاجتياز تأخذها القاعدةُ من الإعدادات، والنتيجةُ لا تُرصد إلا لطالب ترشيحها (مراجعة الجزء 3 النهائية، 2026-10-19):
-- (1) pass_mark_snapshot كان يأتي من العميل، فيستطيع راصدٌ عبثٌ بالواجهة أن يضع 0 فينجح كلُّ طالب (passed عمودٌ مولَّد منها)؛
-- (2) exam_list_item_id و student_id كانا مستقلَّين، فتُرصد نتيجةُ طالبٍ على ترشيح طالبٍ آخر؛
-- (3) anon لا يقرأ هذه الجداول (نقطةُ الصفحة العامة تعمل بـ service_role)، فيُسحب منه المنحُ الافتراضيّ دفاعاً في العمق.
-- لا يمسّ هذا الواجهةَ القديمة: هي ترسل pass_mark_snapshot = قيمةَ الإعدادات نفسها، فيُستبدل بمثلها.

-- 1) المُشغِّل ---------------------------------------------------------------------------------------
-- ما يمنعه guard_result_link من قبل (تغيير الطالب، ونقل نتيجةٍ مربوطةٍ إلى ترشيحٍ آخر) لا يُكرَّر هنا؛
-- يُضاف فقط: الربطُ الجديد (كان null) ممنوع، وتطابقُ الطالب مع طالب الترشيح.
create or replace function private.guard_result_pass_mark()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid;
begin
  -- علامةُ الاجتياز: عند الإدخال من الإعدادات (قيمةُ العميل تُهمَل)، وعند التعديل تبقى كما رُصدت
  if tg_op = 'INSERT' then
    new.pass_mark_snapshot := (select s.pass_mark from public.app_settings s where s.id = 1);
  else
    new.pass_mark_snapshot := old.pass_mark_snapshot;
  end if;

  if new.exam_list_item_id is not null then
    select i.student_id into v_student from public.exam_list_items i where i.id = new.exam_list_item_id;
    if v_student is distinct from new.student_id then
      raise exception 'الطالب في النتيجة لا يطابق طالبَ الترشيح.' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.exam_list_item_id is null and new.exam_list_item_id is not null then
    raise exception 'لا تُربط نتيجةٌ قائمةٌ بترشيحٍ بعد رصدها.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger exam_results_guard_pass_mark
  before insert or update on public.exam_results
  for each row execute function private.guard_result_pass_mark();

revoke all on function private.guard_result_pass_mark() from public, anon, authenticated;

-- 2) anon لا يقرأ جداول الاختبارات ----------------------------------------------------------------------
revoke all on public.exam_lists, public.exam_list_items, public.exam_results from anon;

-- 3) الفحصُ الذاتيّ -----------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger g
                 where not g.tgisinternal and g.tgname = 'exam_results_guard_pass_mark'
                   and g.tgrelid = 'public.exam_results'::regclass and g.tgenabled = 'O'
                   and g.tgfoid = 'private.guard_result_pass_mark()'::regprocedure) then
    raise exception 'مُشغّل exam_results_guard_pass_mark ناقصٌ أو على جدولٍ خاطئ';
  end if;
  if has_function_privilege('authenticated', 'private.guard_result_pass_mark()', 'execute')
     or has_function_privilege('anon', 'private.guard_result_pass_mark()', 'execute') then
    raise exception 'guard_result_pass_mark مكشوفةٌ للعميل';
  end if;
  if has_table_privilege('anon', 'public.exam_lists', 'select')
     or has_table_privilege('anon', 'public.exam_list_items', 'select')
     or has_table_privilege('anon', 'public.exam_results', 'select') then
    raise exception 'anon ما زال يقرأ جداول الاختبارات';
  end if;
  if not (has_table_privilege('authenticated', 'public.exam_results', 'insert')
          and has_table_privilege('authenticated', 'public.exam_list_items', 'insert')) then
    raise exception 'authenticated فقد صلاحيةً لازمة';
  end if;
end $$;
