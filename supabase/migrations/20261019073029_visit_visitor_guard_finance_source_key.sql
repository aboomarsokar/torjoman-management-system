-- ═══════════════════════════════════════════════════════════════════════════
-- جولة الفحص الأولى (2026-10-19): زائر الزيارة، ومفتاح مصدر الحركة المالية
-- ───────────────────────────────────────────────────────────────────────────
-- (١) الزائر: كانت القاعدة تقبل أيّ ملفٍّ زائراً — معلماً، أو مشرفاً ذكراً لحلقة بنات ليست له.
--     الزائر الآن أحد المديرَين (الإداري/الفني)، أو المشرف الميداني المُسنَد للحلقة نفسها.
--     يُفحص عند الإنشاء وعند تغيير الحلقة أو الزائر فقط، فلا تُحبس زيارةٌ قديمة تغيّر مشرف حلقتها بعدها.
-- (٢) الترحيل المالي: «ترحيل كحركة» في الرواتب كان يُدرج حركةً جديدة مع كل ضغطة (تتضاعف المصروفات)،
--     والحوافز المعتمدة لم تكن تُرحَّل أصلاً. `source_key` فريدٌ لكل مصدر (salaries:2026-10 /
--     incentives:2026-10) فيصير الترحيل تحديثاً لحركة الشهر نفسها لا حركةً إضافية.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.guard_visit_visitor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if tg_op = 'UPDATE'
     and new.supervisor_id is not distinct from old.supervisor_id
     and new.halaqa_id is not distinct from old.halaqa_id then
    return new;
  end if;

  select role into v_role from public.profiles where id = new.supervisor_id;
  if v_role in ('admin_manager', 'technical_manager') then
    return new;
  end if;
  if v_role = 'field_supervisor' and exists (
    select 1 from public.halaqat h where h.id = new.halaqa_id and h.supervisor_id = new.supervisor_id
  ) then
    return new;
  end if;
  raise exception 'الزائر أحد المديرَين أو مشرف هذه الحلقة الميداني.' using errcode = '23514';
end;
$$;

drop trigger if exists supervision_visits_guard_visitor on public.supervision_visits;
create trigger supervision_visits_guard_visitor
  before insert or update on public.supervision_visits
  for each row execute function public.guard_visit_visitor();

revoke execute on function public.guard_visit_visitor() from public, anon, authenticated;

alter table public.financial_transactions add column if not exists source_key text;
alter table public.financial_transactions drop constraint if exists financial_transactions_source_key_key;
alter table public.financial_transactions add constraint financial_transactions_source_key_key unique (source_key);
-- الحركة الوحيدة المرحَّلة قبل المفتاح (رواتب 10/2026) تأخذ مفتاحها، فإعادة ترحيلها تُحدّثها لا تكرّرها
update public.financial_transactions
set source_key = 'salaries:2026-10'
where source_key is null and category = 'رواتب' and description = 'رواتب أكتوبر 2026'
  and (select count(*) from public.financial_transactions where category = 'رواتب' and description = 'رواتب أكتوبر 2026') = 1;

comment on column public.financial_transactions.source_key is
  'مصدر الحركة المرحَّلة آلياً (salaries:YYYY-MM / incentives:YYYY-MM) — فريد، فإعادة الترحيل تُحدّث الحركة نفسها. فارغ للحركات اليدوية.';
