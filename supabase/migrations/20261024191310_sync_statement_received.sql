-- «المستلم» في كشف الحوافز يتبع التخصيص ما دام الكشفُ مسوّدة (طلب المستخدم 2026-10-24).
-- كان `incentive_statements.received_amount` يُنسخ من `halaqa_incentives` عند إنشاء الكشف ولا يتحدّث إلا بحفظ المعلم،
-- فكشفٌ بدأه المعلمُ قبل التخصيص ظهر للمراجِع «المستلم 0» والمتبقّي سالباً. الآن كلُّ إدراجٍ أو تعديلٍ لمبلغ التخصيص
-- أو حذفه يحدّث مسوّدةَ كشف الحلقة لذلك الشهر؛ والمُرسَل والمعتمَد لا يُمسّان (أرقامٌ روجعت).

create or replace function private.sync_statement_received()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record := coalesce(new, old);
begin
  perform private.assert_session_writable();
  update public.incentive_statements s
     set received_amount = case when tg_op = 'DELETE' then 0 else new.allocated_amount end
   where s.halaqa_id = r.halaqa_id
     and s.statement_month = r.incentive_month
     and s.statement_year = r.incentive_year
     and s.status = 'draft'
     and s.received_amount is distinct from (case when tg_op = 'DELETE' then 0 else new.allocated_amount end);
  return null;
end;
$$;
revoke all on function private.sync_statement_received() from public, anon, authenticated;

drop trigger if exists halaqa_incentives_sync_statement on public.halaqa_incentives;
create trigger halaqa_incentives_sync_statement
  after insert or delete or update of allocated_amount on public.halaqa_incentives
  for each row
  execute function private.sync_statement_received();

-- مواءمةُ القائم: مسوّداتٌ مستلمُها يخالف التخصيص
update public.incentive_statements s
   set received_amount = a.allocated_amount
  from public.halaqa_incentives a
 where a.halaqa_id = s.halaqa_id and a.incentive_month = s.statement_month and a.incentive_year = s.statement_year
   and s.status = 'draft' and s.received_amount is distinct from a.allocated_amount;
