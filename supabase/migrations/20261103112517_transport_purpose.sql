-- غرضُ رحلة المواصلات (طلب المستخدم 2026-11-03): نصٌّ حرّ إلزاميّ (≤ 200) — و«البيان» صار «الرحلة» في الواجهة.
-- الرحلاتُ القديمة بلا غرض: العمودُ يقبل null، والإلزامُ بمشغّلٍ على الإدراج وعلى تعديل الغرض وحده،
-- فلا يتعطّل تسديدُ الرحلات القديمة (تحديثُ `paid` لا يمسّ الغرض).
alter table public.transport_trips add column purpose text
  constraint transport_trips_purpose_len check (purpose is null or char_length(purpose) <= 200);

create or replace function private.transport_purpose_required()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.purpose is null or btrim(new.purpose) = '' then
    raise exception 'اكتب الغرضَ من الرحلة.' using errcode = '23514';
  end if;
  new.purpose := btrim(new.purpose);
  return new;
end;
$$;
revoke all on function private.transport_purpose_required() from public, anon, authenticated;

create trigger transport_trips_purpose_required
  before insert or update of purpose on public.transport_trips
  for each row execute function private.transport_purpose_required();
