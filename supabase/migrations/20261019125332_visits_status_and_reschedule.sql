-- متابعةُ الزيارات من الكادر الإداري (ROADMAP #15، قرارات 2026-10-19):
-- (١) الحالةُ تُشتقّ من التاريخين في القاعدة: نُفّذت في يوم موعدها أو قبله (بتوقيت غزة) = done، وبعده = late،
--     وبلا تنفيذ = scheduled. «فائتة» (missed) تُحسب عند العرض (مجدولةٌ فات يومُها)، فلا مهمّةَ مجدولة تكتبها.
--     كانت الحالةُ تُكتب من العميل done دائماً، و late/missed لا يكتبهما أحد — فبطاقةُ المتأخّرة صفرٌ أبداً.
-- (٢) تعديلُ الموعد بسببٍ إلزاميّ يُسجَّل في visit_reschedule_log (كان الجدولُ فارغاً منذ البداية): الدالّةُ
--     reschedule_visit تكتب السجلّ ثم الموعد في معاملةٍ واحدة، والحارسُ يرفض أيَّ تغييرٍ للموعد بلا سطر سجلّه.

-- (١) اشتقاقُ الحالة
create or replace function public.derive_visit_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.executed_at is null then
    new.status := 'scheduled';
    return new;
  end if;
  if (new.executed_at at time zone 'Asia/Gaza')::date > (now() at time zone 'Asia/Gaza')::date then
    raise exception 'تاريخ التنفيذ في المستقبل.' using errcode = '23514';
  end if;
  new.status := case
    when (new.executed_at at time zone 'Asia/Gaza')::date <= (new.scheduled_at at time zone 'Asia/Gaza')::date then 'done'
    else 'late'
  end;
  return new;
end
$$;

revoke all on function public.derive_visit_status() from public;

create trigger supervision_visits_derive_status
  before insert or update on public.supervision_visits
  for each row execute function public.derive_visit_status();

-- إعادةُ حساب المنفَّذ القائم بالقاعدة الجديدة
update public.supervision_visits set executed_at = executed_at where executed_at is not null;

-- (٢) تعديلُ الموعد بسبب
create or replace function public.reschedule_visit(p_visit uuid, p_new_time timestamptz, p_reason text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v record;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'اكتب سبب تغيير الموعد.' using errcode = '23514';
  end if;
  select id, scheduled_at, executed_at into v from supervision_visits where id = p_visit;
  if not found then
    raise exception 'الزيارة غير موجودة أو خارج صلاحيتك.' using errcode = '42501';
  end if;
  if v.executed_at is not null then
    raise exception 'زيارةٌ نُفّذت لا يُعدَّل موعدها.' using errcode = '23514';
  end if;
  if v.scheduled_at = p_new_time then
    raise exception 'الموعد الجديد هو نفسه القديم.' using errcode = '23514';
  end if;
  insert into visit_reschedule_log (visit_id, old_time, new_time, reason)
  values (p_visit, v.scheduled_at, p_new_time, btrim(p_reason));
  update supervision_visits set scheduled_at = p_new_time where id = p_visit;
  if not found then
    raise exception 'لم يُحفظ — هذه الزيارة ليست ضمن صلاحيتك.' using errcode = '42501';
  end if;
end
$$;

revoke all on function public.reschedule_visit(uuid, timestamptz, text) from public;
grant execute on function public.reschedule_visit(uuid, timestamptz, text) to authenticated;

create or replace function public.guard_visit_reschedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at and not exists (
    select 1 from visit_reschedule_log l
    where l.visit_id = new.id and l.new_time = new.scheduled_at and l.changed_at = now()
  ) then
    raise exception 'تغيير موعد الزيارة يحتاج سبباً.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.guard_visit_reschedule() from public;

create trigger supervision_visits_guard_reschedule
  before update of scheduled_at on public.supervision_visits
  for each row execute function public.guard_visit_reschedule();
