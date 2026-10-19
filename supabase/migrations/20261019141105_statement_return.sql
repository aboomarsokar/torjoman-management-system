-- إعادةُ كشف الحوافز إلى المعلّم بملاحظةٍ إلزامية (طلب المستخدم 2026-10-19): المراجِعُ (المدير الإداري، والمديرة
-- الإدارية لحلقات البنات — can_review_statement_in_halaqa) يعيد الكشفَ المُرسَل أو المُطّلَع عليه إلى مسوّدة،
-- فيعدّله المعلّم ويرسله ثانية. نفسُ أسلوب إعادة الرصد القرآنيّ. الملاحظةُ تبقى سجلّاً بعد إعادة الإرسال.

alter table public.incentive_statements
  add column return_note text,
  add column returned_by uuid references public.profiles(id),
  add column returned_at timestamptz,
  add constraint incentive_statements_return_note_len
    check (returned_at is null or char_length(btrim(coalesce(return_note, ''))) between 3 and 500);

-- الإعادةُ بدالّةٍ واحدة تفرض الملاحظة (security invoker: تسري RLS والحارس كما لو حدّث المراجِع بنفسه)
create or replace function public.return_statement(p_statement uuid, p_note text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  s record;
begin
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'اكتب سبب الإعادة للمعلّم.' using errcode = '23514';
  end if;
  select id, halaqa_id, status into s from incentive_statements where id = p_statement;
  if not found or not can_review_statement_in_halaqa(s.halaqa_id) then
    raise exception 'الكشف غير موجود أو خارج صلاحيتك.' using errcode = '42501';
  end if;
  if s.status not in ('submitted', 'reviewed') then
    raise exception 'الكشفُ مسوّدةٌ عند المعلّم أصلاً.' using errcode = '23514';
  end if;
  update incentive_statements
     set status = 'draft', return_note = btrim(p_note), returned_by = auth.uid(), returned_at = now(),
         reviewed_by = null, reviewed_at = null
   where id = p_statement;
end
$$;

revoke all on function public.return_statement(uuid, text) from public, anon;
grant execute on function public.return_statement(uuid, text) to authenticated;

-- الحارسُ: كما كان، ويُضاف أنّ المعلّم لا يكتب حقولَ الإعادة ولا يمسحها
create or replace function public.guard_statement_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not public.can_review_statement_in_halaqa(old.halaqa_id) then
      raise exception 'لا يُحذف الكشف بعد إرساله إلا بيد الإدارة' using errcode = '42501';
    end if;
    return old;
  end if;
  if public.can_review_statement_in_halaqa(new.halaqa_id)
     and (tg_op = 'INSERT' or public.can_review_statement_in_halaqa(old.halaqa_id)) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'لا يُعدَّل الكشف بعد إرساله إلا بيد الإدارة' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'لا تملك مراجعة الكشف' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' and (new.reviewed_by is not null or new.reviewed_at is not null))
     or (tg_op = 'UPDATE' and (new.reviewed_by, new.reviewed_at) is distinct from (old.reviewed_by, old.reviewed_at)) then
    raise exception 'لا تملك مراجعة الكشف' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' and (new.return_note is not null or new.returned_by is not null or new.returned_at is not null))
     or (tg_op = 'UPDATE' and (new.return_note, new.returned_by, new.returned_at)
                              is distinct from (old.return_note, old.returned_by, old.returned_at)) then
    raise exception 'ملاحظةُ الإعادة يكتبها المراجِع وحده' using errcode = '42501';
  end if;
  return new;
end
$$;
