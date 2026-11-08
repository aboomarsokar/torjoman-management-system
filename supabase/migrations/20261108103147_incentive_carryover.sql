-- ترحيلُ رصيد الحوافز إلى الشهر التالي (طلب المستخدم 2026-11-08).
-- المبلغُ يُسلَّم للمعلّم نقداً، فما لم يصرفه في يده؛ فيظهر في كشف الشهر التالي سطراً مستقلّاً «رصيدٌ مرحَّل» لا يُدمج
-- في المخصّص (فلا تحسبه المالية مرّتين). المتاحُ = المستلَم + المرحَّل، والمتبقّي = المتاح − المصروف.
-- القواعد: يُرحَّل من كشف الشهر السابق **المُطّلَع عليه** وحده، وما بقي منه موجباً (التجاوزُ لا يُرحَّل)، ويتبع الحلقة
-- لا المعلم، ويتراكم شهراً بعد شهر (المرحَّلُ يدخل في رصيد الكشف). يُحسب في القاعدة وحدها: يتحدّث ما دام الكشفُ
-- مسوّدةً أو مُرسَلاً، ويثبت عند «تمّ الاطّلاع»؛ وإعادتُه للمعلّم تعيد حسابه.

alter table public.incentive_statements
  add column carried_amount numeric not null default 0
  constraint incentive_statements_carried_nonneg check (carried_amount >= 0);

comment on column public.incentive_statements.carried_amount is
  'رصيدٌ مرحَّل من كشف الشهر السابق المُطّلَع عليه (موجبٌ أو صفر) — تحسبه القاعدة، ولا يكتبه العميل';

-- رصيدُ كشف الشهر السابق للحلقة إن كان مُطّلَعاً عليه وبقي منه شيء، وإلا صفر
create or replace function private.statement_carry_from(p_halaqa uuid, p_year int, p_month int)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select greatest(s.received_amount + s.carried_amount
                    - coalesce((select sum(i.amount) from public.incentive_statement_items i where i.statement_id = s.id), 0), 0)
      from public.incentive_statements s
     where s.halaqa_id = p_halaqa
       and s.status = 'reviewed'
       and (s.statement_year, s.statement_month) = (
             case when p_month = 1 then p_year - 1 else p_year end,
             case when p_month = 1 then 12 else p_month - 1 end)
  ), 0)
$$;
revoke all on function private.statement_carry_from(uuid, int, int) from public, anon, authenticated;

-- قبل الحفظ: المرحَّلُ من حساب القاعدة لا من العميل؛ ويثبت ما دام الكشفُ مُطّلَعاً عليه
create or replace function private.set_statement_carry()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'reviewed' and new.status = 'reviewed' then
    new.carried_amount := old.carried_amount;
  else
    new.carried_amount := private.statement_carry_from(new.halaqa_id, new.statement_year, new.statement_month);
  end if;
  return new;
end;
$$;
revoke all on function private.set_statement_carry() from public, anon, authenticated;

-- يحدّث مرحَّلَ كشف الشهر التالي (غيرِ المُطّلَع عليه) حين يتغيّر رصيدُ هذا الكشف
create or replace function private.refresh_next_statement_carry(p_halaqa uuid, p_year int, p_month int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ny int := case when p_month = 12 then p_year + 1 else p_year end;
  nm int := case when p_month = 12 then 1 else p_month + 1 end;
begin
  perform private.assert_session_writable();
  update public.incentive_statements s
     set carried_amount = private.statement_carry_from(s.halaqa_id, s.statement_year, s.statement_month)
   where s.halaqa_id = p_halaqa and s.statement_year = ny and s.statement_month = nm
     and s.status <> 'reviewed'
     and s.carried_amount is distinct from private.statement_carry_from(s.halaqa_id, s.statement_year, s.statement_month);
end;
$$;
revoke all on function private.refresh_next_statement_carry(uuid, int, int) from public, anon, authenticated;

create or replace function private.propagate_statement_carry()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record := coalesce(new, old);
begin
  perform private.refresh_next_statement_carry(r.halaqa_id, r.statement_year, r.statement_month);
  return null;
end;
$$;
revoke all on function private.propagate_statement_carry() from public, anon, authenticated;

create or replace function private.propagate_item_carry()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  s record;
begin
  -- البنودُ لا تغيّر المرحَّل إلا إن كان كشفُها مُطّلَعاً عليه
  for s in
    select distinct st.halaqa_id, st.statement_year, st.statement_month
      from public.incentive_statements st
     where st.id in (new.statement_id, old.statement_id) and st.status = 'reviewed'
  loop
    perform private.refresh_next_statement_carry(s.halaqa_id, s.statement_year, s.statement_month);
  end loop;
  return null;
end;
$$;
revoke all on function private.propagate_item_carry() from public, anon, authenticated;

create trigger incentive_statements_carry
  before insert or update on public.incentive_statements
  for each row execute function private.set_statement_carry();

create trigger incentive_statements_propagate_carry
  after insert or delete or update of status, received_amount, carried_amount on public.incentive_statements
  for each row execute function private.propagate_statement_carry();

create trigger incentive_statement_items_propagate_carry
  after insert or delete or update of amount, statement_id on public.incentive_statement_items
  for each row execute function private.propagate_item_carry();

-- مواءمةُ القائم: كلُّ كشفٍ غيرِ مُطّلَعٍ عليه يُعاد حسابُ مرحَّله
update public.incentive_statements set carried_amount = carried_amount where status <> 'reviewed';
