-- `update_my_contact()` تكتب بصلاحية مالكها (security definer) فتتخطّى السياساتِ التقييديّة للنيابة
-- (impersonation_ro_update على students) — فكان المديرُ الداخلُ بالنيابة عن طالبٍ في وضع القراءة يعدّل حقولَه
-- الأربعة عبرها. يُنادى حارسُ السياسات نفسُه (`private.assert_session_writable()`) قبل أيّ كتابة؛ ومشغّلُ سجلّ
-- النيابة على students يسجّل الكتابةَ في وضع التعديل كما في غيرها. بقيّةُ الدالّة كما في 20261020100838.

create or replace function public.update_my_contact(
  p_phone text,
  p_guardian_email text,
  p_residence text,
  p_nearest_mosque text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(lower(btrim(p_guardian_email)), '');
  v_residence text := nullif(btrim(p_residence), '');
  v_mosque text := nullif(btrim(p_nearest_mosque), '');
begin
  -- النيابةُ في وضع القراءة لا تكتب (الرسالةُ والرمز من الحارس نفسه)
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'student' then
    raise exception 'تعديل هذه البيانات للطالب نفسه.' using errcode = '42501';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'رقم الجوال غير صحيح — أرقامٌ فقط (7 إلى 15).' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'البريد الإلكتروني غير صحيح.' using errcode = '22023';
  end if;
  if length(coalesce(v_residence, '')) > 120 or length(coalesce(v_mosque, '')) > 120 then
    raise exception 'النصّ أطول من 120 حرفاً.' using errcode = '22023';
  end if;

  update public.students
     set phone = v_phone,
         guardian_email = v_email,
         residence = v_residence,
         nearest_mosque = v_mosque
   where user_id = auth.uid();
  if not found then
    raise exception 'لا يوجد سجلّ طالبٍ لحسابك.' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.update_my_contact(text, text, text, text) from public, anon;
grant execute on function public.update_my_contact(text, text, text, text) to authenticated;
