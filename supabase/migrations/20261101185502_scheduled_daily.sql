-- الرسائلُ المجدولة «يومياً» (طلب المستخدم 2026-11-01): كلَّ يومٍ في ساعةٍ محدّدة **عدا الجمعة** (ليست يومَ دوام).
-- تكفي `time_of_day`؛ والموعدُ التالي يتخطّى الجمعة (dow = 5) بتوقيت غزة.
alter table public.scheduled_messages drop constraint scheduled_messages_recurrence_check;
alter table public.scheduled_messages add constraint scheduled_messages_recurrence_check
  check (recurrence in ('once', 'daily', 'weekly', 'monthly'));
alter table public.scheduled_messages drop constraint scheduled_messages_when;
alter table public.scheduled_messages add constraint scheduled_messages_when check (
  (recurrence = 'once' and run_at is not null)
  or (recurrence = 'daily' and time_of_day is not null)
  or (recurrence = 'weekly' and weekday is not null and time_of_day is not null)
  or (recurrence = 'monthly' and month_day is not null and time_of_day is not null));

create or replace function private.scheduled_next_run(p_recurrence text, p_run_at timestamptz, p_weekday smallint,
  p_month_day smallint, p_time time, p_after timestamptz)
returns timestamptz
language plpgsql stable
set search_path = ''
as $$
declare
  v_local timestamp := p_after at time zone 'Asia/Gaza';
  v_day date := v_local::date;
  v_candidate timestamp;
begin
  if p_recurrence = 'once' then
    return case when p_run_at > p_after then p_run_at end;
  elsif p_recurrence = 'daily' then
    v_candidate := v_day + p_time;
    if v_candidate <= v_local then v_candidate := v_candidate + interval '1 day'; end if;
    if extract(dow from v_candidate) = 5 then v_candidate := v_candidate + interval '1 day'; end if;
  elsif p_recurrence = 'weekly' then
    v_candidate := (v_day + ((p_weekday - extract(dow from v_day)::int + 7) % 7)) + p_time;
    if v_candidate <= v_local then v_candidate := v_candidate + interval '7 days'; end if;
  else
    v_candidate := make_date(extract(year from v_day)::int, extract(month from v_day)::int, p_month_day) + p_time;
    if v_candidate <= v_local then v_candidate := v_candidate + interval '1 month'; end if;
  end if;
  return v_candidate at time zone 'Asia/Gaza';
end;
$$;
revoke all on function private.scheduled_next_run(text, timestamptz, smallint, smallint, time, timestamptz) from public, anon, authenticated;
