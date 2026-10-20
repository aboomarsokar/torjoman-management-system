-- الطالب يعدّل أربعة حقولٍ من بياناته بنفسه (طلب المستخدم 2026-10-20): جوّاله، وبريد وليّ أمره، والسكن، وأقرب مسجد.
-- دالّةٌ لا سياسةُ تعديل: سياسةُ UPDATE على students تفتح الصفَّ كلَّه (الاسم والحلقة والحالة والأجزاء…)،
-- و«الحقولُ الأربعة وحدها» لا تُقال بسياسة. الدالّةُ تكتب الأعمدةَ الأربعة فقط في صفّ صاحب الجلسة،
-- فلا يمرّ منها غيرُها ولو أُرسل. وحارسُ guard_student_assignment لا يعترض: لا هويةَ ولا جنسَ ولا حلقةَ تتغيّر.
-- التحقّقُ هنا لا في المتصفّح وحده: الجوّالُ أرقامٌ (7–15، و+ اختيارية)، والبريدُ بشكله، والنصّان ≤ 120 حرفاً.
-- الفارغُ يُحفظ null (مسحٌ مقصود).

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
  -- الطالبُ النشطُ بجلسةٍ قائمة وحده (current_user_role تشترط الحالة والجلسة)
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
