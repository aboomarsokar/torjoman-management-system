-- ============================================================================
-- الصورة الشخصية — جولة الإصلاح الأولى (مراجعة Task 6b، 2026-10-18)
-- يسبقها: 20261018080234_profile_photos.sql · الاختبار: supabase/tests/v2_rls.sql (ص-1 … ص-11)
--
-- الثغرة: جنسُ الطالب في موضعين لا يتزامنان. تعديلُ جنسه يمسّ students.gender وحدَه، والقيدُ
-- ودالّتا المستودع تقرأ profiles.gender — فطالبٌ أُنشئ ذكراً ورفع صورة ثم صُحّح جنسُه إلى أنثى
-- تبقى صورتُها مقروءةً لكلّ الموظفين. الإصلاح:
--   (أ) مُشغِّلٌ على students يزامن profiles.gender لحساب الطالب عند الإدراج وعند تغيّر gender/user_id.
--   (ب) مُشغِّلٌ BEFORE UPDATE على profiles يُفرغ photo_path حين يصير الحسابُ أنثى — بدل أن
--       يُرمى 23514 إنجليزيّ على المدير (يُغلق ملاحظةَ «تحويل ذكرٍ له صورة إلى أنثى»).
--   (ج) القراءةُ لغير صاحب الصورة والمدير الإداري تشترط photo_path غيرَ فارغ — فالكائنُ اليتيم
--       في المسار المتوقَّع <id>/photo.webp (بعد إفراغ المسار أو حذفٍ فاشل) لا يُوقَّع.
--       ودالّتا المستودع ترفضان كذلك إن كان سجلُّ الطالب المرتبط أنثى (حراسةٌ من الانحراف).
--
-- لماذا لا يُمسّ guard_profile_privileged:
--   • (أ) لا يعمل إلا حين يتغيّر students.gender أو students.user_id فعلاً، وهذان للمدير الإداري
--     وحده (guard_student_assignment) أو للخدمة (auth.uid() فارغ) — وكلاهما يمرّ من الحارس.
--     تعديلُ المعلّم لطالبٍ بلا تغيير الجنس لا يُطلق المزامنة أصلاً (شرط WHEN).
--   • (ب) يمسّ photo_path وحدَه، والحارسُ لا يحرسه.
-- ترتيبُ المُشغِّلات أبجديّ: profiles_guard_privileged ← profiles_photo_clear_on_female ←
-- trg_profiles_updated_at — فالحارسُ يرفض تغييرَ الجنس غيرَ المأذون قبل أن يُفرَغ شيء، والقيدُ
-- يُفحص بعد كلّ مُشغِّلات BEFORE.
-- ============================================================================

-- (ب) إفراغُ الصورة حين يصير الحسابُ أنثى
create or replace function public.clear_photo_on_female()
returns trigger language plpgsql set search_path = public as $$
begin
  new.photo_path := null;
  return new;
end $$;

revoke all on function public.clear_photo_on_female() from public, anon;
grant execute on function public.clear_photo_on_female() to authenticated;

drop trigger if exists profiles_photo_clear_on_female on public.profiles;
-- عند تغيّر الجنس وحدَه: كتابةُ مسارٍ مباشرةً لحساب أنثى (طلبٌ مصنوع لا مسارُ واجهة) يبقى
-- مردوداً بالقيد profiles_photo_path_shape (23514).
create trigger profiles_photo_clear_on_female
  before update on public.profiles
  for each row
  when (new.gender = 'female' and new.photo_path is not null and new.gender is distinct from old.gender)
  execute function public.clear_photo_on_female();

-- (أ) مزامنةُ جنس الطالب إلى حسابه
create or replace function public.sync_student_gender_to_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    update public.profiles p
       set gender = new.gender
     where p.id = new.user_id
       and p.role = 'student'
       and p.gender is distinct from new.gender;
  end if;
  return null;
end $$;

revoke all on function public.sync_student_gender_to_profile() from public, anon;
grant execute on function public.sync_student_gender_to_profile() to authenticated;

drop trigger if exists students_sync_gender_to_profile_ins on public.students;
drop trigger if exists students_sync_gender_to_profile_upd on public.students;
create trigger students_sync_gender_to_profile_ins
  after insert on public.students
  for each row
  when (new.user_id is not null)
  execute function public.sync_student_gender_to_profile();
create trigger students_sync_gender_to_profile_upd
  after update of gender, user_id on public.students
  for each row
  when (new.user_id is not null
        and (new.gender is distinct from old.gender or new.user_id is distinct from old.user_id))
  execute function public.sync_student_gender_to_profile();

-- تسويةُ ما انحرف قبل المزامنة (بصلاحية الهجرة: auth.uid() فارغ فيمرّ الحارس)، ثم مسحُ أيّ مسارٍ لأنثى.
update public.profiles p
   set gender = s.gender
  from public.students s
 where s.user_id = p.id
   and p.role = 'student'
   and p.gender is distinct from s.gender;

update public.profiles set photo_path = null where gender = 'female' and photo_path is not null;

-- (ج) دالّتا المستودع
-- الكتابة: صاحبُ المجلّد أو المديرُ الإداري، ولا لأنثى (في profiles أو في سجلّ الطالب المرتبط).
create or replace function public.can_manage_profile_photo(p_folder text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_folder is null
     or p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = p_folder::uuid
      and p.gender is distinct from 'female'
      and not exists (select 1 from public.students s where s.user_id = p.id and s.gender = 'female')
      and (p.id = auth.uid() or public.is_admin_manager())
  );
end $$;

-- القراءة (توليد الرابط الموقَّع):
--   • من يملك الكتابة (صاحبُها والمديرُ الإداري) يقرأ ولو كان المسارُ فارغاً — رفعُ `upsert`
--     يقرأ الكائنَ الجديد قبل أن يُكتب المسارُ في الصفّ، فاشتراطُ المسار عليه يكسر الرفعَ الأول.
--   • غيرُهما (كلُّ حسابٍ نشطٍ غيرِ طالب) يقرأ فقط إن كان photo_path مضبوطاً — فاليتيمُ لا يُوقَّع.
create or replace function public.can_view_profile_photo(p_folder text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if public.can_manage_profile_photo(p_folder) then
    return true;
  end if;
  if p_folder is null
     or p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = p_folder::uuid
      and p.photo_path is not null
      and p.gender is distinct from 'female'
      and not exists (select 1 from public.students s where s.user_id = p.id and s.gender = 'female')
      and coalesce(public.current_user_role() <> 'student', false)
  );
end $$;

revoke all on function public.can_view_profile_photo(text) from public, anon;
revoke all on function public.can_manage_profile_photo(text) from public, anon;
grant execute on function public.can_view_profile_photo(text) to authenticated;
grant execute on function public.can_manage_profile_photo(text) to authenticated;
