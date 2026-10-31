-- لجنةُ تحكيم المرشّحين من الإداريين والمختبرين وحدهم (طلب المستخدم 2026-10-30):
-- المدير الإداري ومشرف المشروع والمدير الفني والمختبِر.
create or replace function private.candidate_committee_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id and p.status::text = 'active'
      and p.role::text in ('admin_manager', 'project_supervisor', 'technical_manager', 'examiner')
  ) then
    raise exception 'عضوُ اللجنة من الإداريين أو المختبرين النشطين.' using errcode = '23514';
  end if;
  return new;
end;
$function$;
