-- نتائجُ اختباراتٍ سابقةٍ لبداية المشروع (منهجٌ جديد قبل 1/10/2026) تُستورد بيد الإدارة بتواريخها الحقيقية.
-- العلمُ is_legacy يُعفيها من قيد بداية المشروع وحده؛ ولا يرفعه العميل (حارس) — تكتبه الإدارة من القاعدة.

alter table public.exam_lists add column is_legacy boolean not null default false;
alter table public.exam_results add column is_legacy boolean not null default false;

comment on column public.exam_lists.is_legacy is 'ترشيحٌ مستورَدٌ من سجلّاتٍ سابقةٍ لبداية المشروع — يُعفى من قيد التاريخ، ولا يرفعه العميل.';
comment on column public.exam_results.is_legacy is 'نتيجةٌ مستورَدةٌ من سجلّاتٍ سابقةٍ لبداية المشروع — تُعفى من قيد التاريخ، ولا يرفعها العميل.';

alter table public.exam_lists drop constraint exam_lists_from_project_start;
alter table public.exam_lists add constraint exam_lists_from_project_start
  check (week_date >= '2026-10-01'::date or is_legacy);

alter table public.exam_results drop constraint exam_results_from_project_start;
alter table public.exam_results add constraint exam_results_from_project_start
  check (exam_date >= '2026-10-01'::date or is_legacy);

create or replace function private.guard_legacy_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.is_legacy)
     or (tg_op = 'UPDATE' and new.is_legacy is distinct from old.is_legacy) then
    if session_user in ('authenticator', 'anon', 'authenticated') then
      raise exception 'علامةُ الاستيراد تضعها الإدارة من القاعدة وحدها.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_legacy_flag() from public, anon, authenticated;

create trigger exam_lists_guard_legacy before insert or update of is_legacy on public.exam_lists
  for each row execute function private.guard_legacy_flag();
create trigger exam_results_guard_legacy before insert or update of is_legacy on public.exam_results
  for each row execute function private.guard_legacy_flag();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'exam_lists_guard_legacy')
     or not exists (select 1 from pg_trigger where tgname = 'exam_results_guard_legacy') then
    raise exception 'حارسُ علامة الاستيراد ناقص';
  end if;
  if has_function_privilege('authenticated', 'private.guard_legacy_flag()', 'execute') then
    raise exception 'دالّةُ الحارس مكشوفةٌ للعميل';
  end if;
end $$;
