-- ═══════════════════════════════════════════════════════════════════════════
-- قرارا المستخدم 2026-10-19 في الاختبارات
-- ───────────────────────────────────────────────────────────────────────────
-- (١) درجة التجويد من 7 إلى 9 (لا 10). القيد NOT VALID: يسري على كل رصدٍ جديد أو تعديل، ولا يُسقط
--     نتيجةً قائمة فوقه (نتيجة واحدة تجريبية بدرجة 10 — يقرّر المستخدم فيها).
-- (٢) تسلسل المحطات: لا يُرشَّح طالبٌ لمحطة قبل اجتياز كل ما قبلها. الترتيب بنهاية النطاق
--     (parts_to تصاعدياً: 1–3، 1–5، 6–8، 6–10…) — لا بالمعرّف (1–3 و1–5 معرّفاهما 13 و14).
--     ⚠️ إن قُلبت الخطة لتبدأ من الناس (الأولوية ٢-ب) يتغيّر مفتاح الترتيب هنا.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.exam_results drop constraint if exists exam_results_tajweed_score_check;
alter table public.exam_results add constraint exam_results_tajweed_score_check
  check (tajweed_score >= 7 and tajweed_score <= 9) not valid;

create or replace function public.guard_station_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to int;
  v_missing text;
begin
  if tg_op = 'UPDATE'
     and new.exam_plan_id is not distinct from old.exam_plan_id
     and new.student_id is not distinct from old.student_id then
    return new;
  end if;

  select parts_to into v_to from public.exam_plan where id = new.exam_plan_id;
  if v_to is null then return new; end if;

  -- أوّل محطةٍ سابقة لم يجتزها الطالب
  select format('الأجزاء %s–%s', p.parts_from, p.parts_to) into v_missing
  from public.exam_plan p
  where p.parts_to < v_to
    and not exists (
      select 1 from public.exam_results er
      join public.exam_list_items li on li.id = er.exam_list_item_id
      where li.student_id = new.student_id and li.exam_plan_id = p.id and er.passed)
  order by p.parts_to
  limit 1;

  if v_missing is not null then
    raise exception 'لا يُرشَّح الطالب لهذه المحطة قبل اجتياز %.', v_missing using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_list_items_guard_sequence on public.exam_list_items;
create trigger exam_list_items_guard_sequence
  before insert or update on public.exam_list_items
  for each row execute function public.guard_station_sequence();

revoke execute on function public.guard_station_sequence() from public, anon, authenticated;
