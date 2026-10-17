-- ============================================================================
-- اختبار سياسات الإصدار الثاني (الأدوار السبعة والنطاق بالقسم)
-- الهجرة: supabase/migrations/20261017120000_v2_roles_rls.sql
--
-- كل بلوك معاملةٌ مستقلّة تُلغى في آخرها (rollback) — لا يبقى منها شيء.
-- يُشغَّل كل بلوك وحده عبر MCP execute_sql على qwtqfkayupzijcoguqrf.
-- التجهيز (تغيير الدور/القسم/الربط) يجري قبل الانتحال وبصلاحية postgres،
-- فلا يعترضه حارس الأعمدة الامتيازية (auth.uid() فارغ عندها).
-- البلوكات الرافضة كلٌّ في استدعاءٍ منفصل لأن الخطأ يُجهض المعاملة،
-- والمتوقّع فيها هو الخطأ نفسه.
--
-- المعرّفات حقيقية من البيانات التجريبية (2026-10-17):
--   f277ca54-19f8-4118-9998-3da0b6c56a52  مدير سابق (manager → admin_manager)
--   83d2ae2d-5e41-4091-88c8-92ba81b10e36  مدير سابق (manager → admin_manager)
--   57d4f047-73c5-4dab-89a2-7ebcb4790fc5  مشرف حلقات البنين الأربع (supervisor → field_supervisor)
--   9a4ab16b-992e-45b2-a979-3dbff6af2aef  معلمة «حلقة حراء» (13 طالبة)
--   da6b10ba-b934-40ce-98d1-e79834c0ecd2  حلقة حراء (بنات)
--   1b61e1ee-0b0d-4ac2-bc7c-0f8dbe343ce1  حلقة أبو خضرة (بنين، مشرفها 57d4f047)
--   ee06a4f1-e381-42d8-afd4-bdfd6f9332ec  حلقة السيد هاشم (بنين، مشرفها 57d4f047)
--   61017856-484a-445f-b433-8c45b240e17f  حلقة الشنطي (بنات، مشرفتها غيره)
--   1bb8a68f-4beb-4a74-b7e5-321945ddee71  طالب في حلقة أبو خضرة
--   101d082c-0faa-48c7-a0a8-8974ef69eea5  طالبة في حلقة حراء
-- الأعداد: 9 حلقات (4 بنين، 5 بنات)، 160 طالباً (71 بنين، 89 بنات)، 221 نتيجة اختبار.
-- ============================================================================


-- (أ) مشرف المشروع يقرأ كل شيء
-- المتوقّع: halaqat_seen = 9، students_seen = 160، results_seen = 221، fin_seen = 0 (الجدول فارغ)
begin;
update profiles set role = 'project_supervisor' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
create temp table _r on commit drop as select
  (select count(*) from halaqat) halaqat_seen,
  (select count(*) from students) students_seen,
  (select count(*) from exam_results) results_seen,
  (select count(*) from financial_transactions) fin_seen;
reset role; select * from _r; rollback;


-- (ب) المديرة الإدارية (section=female) ترى حلقات البنات وطالباتهنّ فقط
-- المتوقّع: halaqat_seen = 5، male_seen = 0، students_seen = 89، male_students_seen = 0
begin;
update profiles set role = 'admin_manager', gender = 'female', section = 'female' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
create temp table _r on commit drop as select
  (select count(*) from halaqat) halaqat_seen,
  (select count(*) filter (where gender = 'male') from halaqat) male_seen,
  (select count(*) from students) students_seen,
  (select count(*) filter (where gender = 'male') from students) male_students_seen;
reset role; select * from _r; rollback;


-- (ج) المعلمة ترى حلقتها وطلابها فقط
-- المتوقّع: halaqat_seen = 1، own_halaqa_seen = 1، students_seen = 13، other_students_seen = 0
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '9a4ab16b-992e-45b2-a979-3dbff6af2aef', 'role', 'authenticated')::text, true);
create temp table _r on commit drop as select
  (select count(*) from halaqat) halaqat_seen,
  (select count(*) from halaqat where id = 'da6b10ba-b934-40ce-98d1-e79834c0ecd2') own_halaqa_seen,
  (select count(*) from students) students_seen,
  (select count(*) from students where halaqa_id <> 'da6b10ba-b934-40ce-98d1-e79834c0ecd2') other_students_seen;
reset role; select * from _r; rollback;


-- (د) الطالب يرى صفّه فقط (وحلقته)
-- التجهيز: حساب مدير سابق يصير «student» ويُربط بطالبة حراء (لا يُشرف على حلقة ولا يعلّمها)
-- المتوقّع: students_seen = 1، own_row_seen = 1، halaqat_seen = 1، my_student_id_ok = true،
--           results_seen = own_results_total (نتائجه وحده)
begin;
update profiles set role = 'student' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
update students set user_id = 'f277ca54-19f8-4118-9998-3da0b6c56a52' where id = '101d082c-0faa-48c7-a0a8-8974ef69eea5';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
create temp table _r on commit drop as select
  (select count(*) from students) students_seen,
  (select count(*) from students where id = '101d082c-0faa-48c7-a0a8-8974ef69eea5') own_row_seen,
  (select count(*) from halaqat) halaqat_seen,
  (public.my_student_id() = '101d082c-0faa-48c7-a0a8-8974ef69eea5') my_student_id_ok,
  (select count(*) from exam_results) results_seen;
reset role;
select _r.*, (select count(*) from exam_results where student_id = '101d082c-0faa-48c7-a0a8-8974ef69eea5') own_results_total from _r;
rollback;


-- (هـ-1) المشرف الميداني يُسند طالباً من حلقته إلى حلقةٍ أخرى من حلقاته — ينجح
-- المتوقّع: new_halaqa = ee06a4f1-e381-42d8-afd4-bdfd6f9332ec (السيد هاشم)
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '57d4f047-73c5-4dab-89a2-7ebcb4790fc5', 'role', 'authenticated')::text, true);
update students set halaqa_id = 'ee06a4f1-e381-42d8-afd4-bdfd6f9332ec' where id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71';
reset role;
select halaqa_id as new_halaqa from students where id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71';
rollback;


-- (هـ-2) المشرف الميداني يُسند الطالب نفسه إلى حلقةٍ ليست له — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك إسناد الطالب لهذه الحلقة» (حارس الإسناد)
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '57d4f047-73c5-4dab-89a2-7ebcb4790fc5', 'role', 'authenticated')::text, true);
update students set halaqa_id = '61017856-484a-445f-b433-8c45b240e17f' where id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71';
rollback;


-- (و) مشرف المشروع لا يكتب: insert على halaqat يُرفض
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "halaqat"
begin;
update profiles set role = 'project_supervisor' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
insert into halaqat (name, teacher_id, gender) values ('حلقة اختبار', '9a4ab16b-992e-45b2-a979-3dbff6af2aef', 'female');
rollback;


-- (ز) المعلمة لا ترفع دورها: update على profiles.role لنفسها يُرفض
-- المتوقّع: ERROR 42501 «لا تملك تعديل الدور أو القسم أو الرقم الوظيفي أو الحالة» (الحارس)
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '9a4ab16b-992e-45b2-a979-3dbff6af2aef', 'role', 'authenticated')::text, true);
update profiles set role = 'admin_manager' where id = '9a4ab16b-992e-45b2-a979-3dbff6af2aef';
rollback;


-- (ح) المعلمة تعدّل حقلاً غير امتيازيّ في ملفّها — ينجح (الحارس لا يمنع إلا الامتيازي)
-- المتوقّع: phone = '0599000000'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '9a4ab16b-992e-45b2-a979-3dbff6af2aef', 'role', 'authenticated')::text, true);
update profiles set phone = '0599000000' where id = '9a4ab16b-992e-45b2-a979-3dbff6af2aef';
reset role;
select phone from profiles where id = '9a4ab16b-992e-45b2-a979-3dbff6af2aef';
rollback;


-- (ط) الزائر (anon) يقرأ الأخبار المنشورة دون خطأ صلاحية على دوالّ النطاق
-- المتوقّع: news_seen = عدد الأخبار المنشورة (4 اليوم)، بلا «permission denied for function»
begin;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
create temp table _r on commit drop as select (select count(*) from news) news_seen;
reset role; select _r.*, (select count(*) from news where published) published_total from _r; rollback;
