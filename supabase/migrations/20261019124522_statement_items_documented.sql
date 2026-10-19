-- توثيقُ بنود كشف الحوافز (ROADMAP #13): لكلّ بندٍ بيانٌ واضح وتاريخٌ داخل شهر كشفه لا يتجاوز اليوم ومبلغٌ موجب.
-- الواجهة تتحقّق أولاً برسائل عربية، وهذا الحَكَم. القيدان NOT VALID: بيانات التجريب فيها بندٌ بمبلغ 0 وبيانٌ من حرف،
-- فلا يُعاد فحص القديم ويُفرض على كلّ إدراجٍ أو تعديلٍ جديد. الحدُّ 3 = MIN_ITEM_DESCRIPTION_LENGTH في app/constants/incentives.ts.

alter table public.incentive_statement_items
  alter column description set not null,
  alter column item_date set not null;

alter table public.incentive_statement_items
  add constraint incentive_statement_items_description_len check (char_length(btrim(description)) >= 3) not valid,
  add constraint incentive_statement_items_amount_positive check (amount > 0) not valid;

-- التاريخُ داخل شهر الكشف (يحتاج قراءةَ الكشف، فلا يكفيه قيدُ CHECK)، ولا يتجاوز اليوم بتوقيت غزة
create or replace function public.guard_statement_item_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m int;
  y int;
begin
  select statement_month, statement_year into m, y from incentive_statements where id = new.statement_id;
  if date_trunc('month', new.item_date)::date <> make_date(y, m, 1) then
    raise exception 'تاريخ البند خارج شهر الكشف.' using errcode = '23514';
  end if;
  if new.item_date > (now() at time zone 'Asia/Gaza')::date then
    raise exception 'تاريخ البند في المستقبل.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.guard_statement_item_date() from public;

create trigger incentive_statement_items_guard_date
  before insert or update of item_date, statement_id on public.incentive_statement_items
  for each row execute function public.guard_statement_item_date();
