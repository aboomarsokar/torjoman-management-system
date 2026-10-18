-- ============================================================================
-- الصورة الشخصية — اختياريّةٌ لكلّ حساب، ولا صور لقسم البنات (Task 6b، قرار المستخدم 2026-10-18)
-- منقولةٌ من الصحابة: 20260927120000_employee_photo.sql + 20260928120000_employee_photo_write_guards.sql
-- الاختبار: supabase/tests/v2_rls.sql (البلوكات ص-1 … ص-7)
--
-- • مسارٌ في عمودٍ لا صورةٌ في عمود، واسمٌ ثابت `<profile_id>/photo.webp` — الاستبدالُ `upsert`
--   فلا يتراكم يتيمٌ في الحصّة. التصغيرُ في المتصفّح، والحدُّ (256 ك.ب) في المستودع.
-- • المستودعُ **خاصّ**: صورةُ شخص، والرابطُ العامّ يبقى صالحاً لمن حفظه بعد أن تُزال الصورة.
--   فالقراءةُ بروابطَ موقَّعةٍ لساعة، وسياسةُ القراءة تحرس توليدَها.
-- • المجلّدُ بمعرّف الحساب (`profiles.id`) — على الموظف والطالب معاً (للطالب حسابٌ في profiles).
-- • **لا صورة لأيّ حساب `gender = 'female'`**: القيدُ يرفض المسار، وسياساتُ المستودع ترفض
--   الرفعَ والقراءة، والواجهةُ لا تعرض الحقلَ وتُبقي الحرفَ الأول.
-- • `guard_profile_privileged` قائمةُ منعٍ مسمّاة (الدور/الحالة/الرقم/الجنس/علَم كلمة المرور)
--   و`photo_path` ليس فيها — فيكتبه صاحبُ الصفّ والمديرُ الإداري (سياسة profiles_update).
-- • `avatar_url` في profiles وstudents باقٍ بلا استعمال، ويُسقط بعد النشر (درس «إسقاط العمود بعد النشر»).
-- • ما سقط من الصحابة: المدارس والنيابة والمدير العامّ وتفويضُ `staff` — لا وجود لها هنا.
-- ============================================================================

alter table public.profiles
  add column if not exists photo_path text;

comment on column public.profiles.photo_path is
  'مسار الصورة الشخصية داخل المستودع الخاص profile-photos (<id>/photo.webp) — لا رابط كامل. اختيارية، ولا صورة لحساب أنثى.';

alter table public.profiles
  drop constraint if exists profiles_photo_path_shape;

-- المسارُ مسارُ الصفّ نفسِه وحدَه: صفٌّ يُكتب بمسار زميلٍ يعرض وجهَ غيره. ولا مسارَ لحساب أنثى.
alter table public.profiles
  add constraint profiles_photo_path_shape check (
    photo_path is null
    or (photo_path = id::text || '/photo.webp' and gender is distinct from 'female')
  );

-- ═══════════════ دالّتا السياسات ═══════════════
-- المجلّدُ نصّ (أوّل مقطع من اسم الكائن)؛ يُفحص شكلُه قبل التحويل إلى uuid — اسمٌ غيرُ uuid
-- يُرَدّ بـ false لا بخطأ صياغة، والتحويلُ على جهة الثابت يستعمل فهرسَ المفتاح.
-- و`storage.foldername()` يُرجع مصفوفةً فارغة لاسمٍ جذريّ، فالمقطعُ NULL ⇒ false.

-- القراءة (توليد الرابط الموقَّع): صاحبُ الصورة، وكلُّ حسابٍ نشطٍ غيرِ طالب — كقراءة profiles.
create or replace function public.can_view_profile_photo(p_folder text)
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
      and (p.id = auth.uid() or coalesce(public.current_user_role() <> 'student', false))
  );
end $$;

-- الكتابة/الاستبدال/الحذف: صاحبُ المجلّد أو المديرُ الإداري — وفقط إن لم يكن صاحبُ المجلّد أنثى.
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
      and (p.id = auth.uid() or public.is_admin_manager())
  );
end $$;

revoke all on function public.can_view_profile_photo(text) from public, anon;
revoke all on function public.can_manage_profile_photo(text) from public, anon;
grant execute on function public.can_view_profile_photo(text) to authenticated;
grant execute on function public.can_manage_profile_photo(text) to authenticated;

-- ═══════════════ المستودع ═══════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 262144, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_photos_read   on storage.objects;
drop policy if exists profile_photos_insert on storage.objects;
drop policy if exists profile_photos_update on storage.objects;
drop policy if exists profile_photos_delete on storage.objects;

create policy profile_photos_read on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-photos'
    and coalesce(public.can_view_profile_photo((storage.foldername(name))[1]), false)
  );

-- الاسمُ الثابتُ يُفرض في الكتابة: `<id>/selfie.jpg` يتيمٌ لا يُشير إليه صفٌّ ولا يُحذف.
create policy profile_photos_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'profile-photos'
    and name = coalesce((storage.foldername(name))[1], '') || '/photo.webp'
    and coalesce(public.can_manage_profile_photo((storage.foldername(name))[1]), false)
  );

-- `with check` يكرّر الشرطَ ومعه الاسمُ الثابت (درس الصحابة 2026-09-28): بلا ذلك يُقبل نقلُ
-- `<id>/photo.webp` إلى اسمٍ حرّ أو إلى مجلّد غيره.
create policy profile_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and coalesce(public.can_manage_profile_photo((storage.foldername(name))[1]), false)
  )
  with check (
    bucket_id = 'profile-photos'
    and name = coalesce((storage.foldername(name))[1], '') || '/photo.webp'
    and coalesce(public.can_manage_profile_photo((storage.foldername(name))[1]), false)
  );

create policy profile_photos_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'profile-photos'
    and coalesce(public.can_manage_profile_photo((storage.foldername(name))[1]), false)
  );

-- ═══════════════ فحصٌ ذاتيّ للقيد (يُلغى أثرُه) ═══════════════
-- على أوّل حسابٍ موجود: مسارُ غيره مردود، والاسمُ الحرّ مردود، ومسارُه مقبول، والأنثى بمسارٍ مردودة.
do $$
declare
  v_id uuid;
  v_verdict text;
begin
  select id into v_id from public.profiles order by created_at limit 1;
  if v_id is null then
    raise notice 'لا حساب — القيد قائمٌ بلا فحص';
    return;
  end if;

  begin
    begin
      update public.profiles set photo_path = gen_random_uuid()::text || '/photo.webp' where id = v_id;
      raise exception '❌ قُبل مسارُ حسابٍ آخر' using errcode = 'P9003';
    exception when check_violation then null;
    end;
    begin
      update public.profiles set photo_path = v_id::text || '/selfie.jpg' where id = v_id;
      raise exception '❌ قُبل اسمُ ملفٍّ غيرُ الثابت' using errcode = 'P9003';
    exception when check_violation then null;
    end;
    update public.profiles set photo_path = v_id::text || '/photo.webp' where id = v_id;
    begin
      update public.profiles set gender = 'female' where id = v_id;
      raise exception '❌ قُبلت أنثى بصورة' using errcode = 'P9003';
    exception when check_violation then null;
    end;
    raise exception '✅ مسارُ الغير والاسمُ الحرّ والأنثى مردودة، ومسارُ الصفّ مقبول' using errcode = 'P9003';
  exception when sqlstate 'P9003' then
    v_verdict := sqlerrm;  -- الخروجُ بالاستثناء يُلغي تعديلاتِ الفحص كلَّها
  end;

  if v_verdict is null or v_verdict not like '✅%' then
    raise exception '%', coalesce(v_verdict, '❌ الفحص لم يُبلغ نتيجة');
  end if;
  raise notice '%', v_verdict;
end $$;
