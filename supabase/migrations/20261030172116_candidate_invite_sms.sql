-- رسالةُ دعوة المقابلة عبر SMS (طلب المستخدم 2026-10-30): وقتُ آخر إرسالٍ ناجح، يضعه المسارُ الخادميّ `/api/candidates/invite-sms`
-- ويُصفَّر عند تغيير الموعد أو المكان كي لا يُظنّ أنّ الموعدَ الجديد أُبلغ.
alter table public.candidates add column invite_sms_at timestamptz;

create or replace function private.candidates_invite_sms_reset()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.interview_at is distinct from old.interview_at or new.interview_place is distinct from old.interview_place then
    new.invite_sms_at := null;
  end if;
  return new;
end;
$function$;
revoke all on function private.candidates_invite_sms_reset() from public, anon, authenticated;

create trigger candidates_invite_sms_reset before update of interview_at, interview_place on public.candidates
  for each row execute function private.candidates_invite_sms_reset();
