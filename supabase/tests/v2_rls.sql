-- ============================================================================
-- اختبار سياسات الإصدار الثاني (الأدوار الثمانية؛ النطاق في الدور، لا عمود section)
-- الهجرات: supabase/migrations/20261017132335_v2_roles_rls.sql
--          supabase/migrations/20261017135124_v2_women_admin_role.sql
--          supabase/migrations/20261017135631_v2_hardening.sql
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
--   808c23f2-736c-4284-aa53-342cefce5080  معلم «حلقة أبو خضرة»
--   440cee96-f113-4314-bf53-9d49ef0bcbae  معلم «حلقة السيد هاشم» (عليه التنبيه 306a8007)
--   6ccc79fb-1a66-4a84-a994-3e8b1e5d03c9  حلقة الشافعي (بنين)
--   0096e1c3-0fd1-4337-8f50-bc9d62359142  نتيجة اختبار لطالبٍ في حلقة الشافعي
--   e10022af-27be-4edc-9352-1086e34ff573  تقرير «أبو خضرة» 4/2026 (draft)
--   306a8007-977b-4434-a1f2-0d205f5f335c  تنبيه إداري على 440cee96
-- الأعداد: 9 حلقات (4 بنين، 5 بنات)، 160 طالباً (71 بنين، 89 بنات)، 221 نتيجة اختبار.
-- لا women_admin في البيانات: تُنشأ داخل المعاملة من حساب f277ca54.
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


-- (ب) المديرة الإدارية (women_admin) ترى حلقات البنات وطالباتهنّ فقط
-- المتوقّع: halaqat_seen = 5، male_seen = 0، students_seen = 89، male_students_seen = 0
begin;
update profiles set role = 'women_admin', gender = 'female' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
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
--           results_seen = own_results_total (نتائجه وحده)،
--           own_profile_seen = 1، other_profiles_seen = 0 (الطالب لا يقرأ ملفّات غيره)
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
  (select count(*) from exam_results) results_seen,
  (select count(*) from profiles where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52') own_profile_seen,
  (select count(*) from profiles where id <> 'f277ca54-19f8-4118-9998-3da0b6c56a52') other_profiles_seen;
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
-- المتوقّع: ERROR 42501 «لا تملك تعديل الدور أو الحالة أو الرقم الوظيفي أو الجنس» (الحارس)
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


-- ============================================================================
-- جولة الإصلاح الأولى: المديرة الإدارية، وشخصٌ واحد لكلّ مدير، والحرّاس F1–F8
-- ============================================================================

-- (م-1) المديرة تُسند طالبةً من «حراء» إلى «الشنطي» (حلقتا بنات) — ينجح
-- المتوقّع: new_halaqa = 61017856-484a-445f-b433-8c45b240e17f
begin;
update profiles set role = 'women_admin', gender = 'female' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
update students set halaqa_id = '61017856-484a-445f-b433-8c45b240e17f' where id = '101d082c-0faa-48c7-a0a8-8974ef69eea5';
reset role;
select halaqa_id as new_halaqa from students where id = '101d082c-0faa-48c7-a0a8-8974ef69eea5';
rollback;


-- (م-2) المديرة تُسند الطالبة نفسها إلى «السيد هاشم» (بنين) — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك إسناد الطالب لهذه الحلقة»
begin;
update profiles set role = 'women_admin', gender = 'female' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
update students set halaqa_id = 'ee06a4f1-e381-42d8-afd4-bdfd6f9332ec' where id = '101d082c-0faa-48c7-a0a8-8974ef69eea5';
rollback;


-- (م-3) المديرة لا تنشئ حلقة — يُرفض
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "halaqat"
begin;
update profiles set role = 'women_admin', gender = 'female' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
insert into halaqat (name, teacher_id, gender) values ('حلقة اختبار', '9a4ab16b-992e-45b2-a979-3dbff6af2aef', 'female');
rollback;


-- (م-4) المديرة لا تعدّل حلقة بنات ولا ترى المالية (يُزرع قيدٌ ماليٌّ واحد في التجهيز)
-- المتوقّع: halaqa_rows_updated = 0 (الاسم باقٍ «حلقة حراء»)، fin_seen = 0 من fin_total = 1
begin;
update profiles set role = 'women_admin', gender = 'female' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
insert into financial_transactions (type, amount, description) values ('income', 100, 'قيد اختبار');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
update halaqat set name = 'اسم مغيَّر' where id = 'da6b10ba-b934-40ce-98d1-e79834c0ecd2';
create temp table _r on commit drop as select (select count(*) from financial_transactions) fin_seen;
reset role;
select _r.*, (select count(*) from financial_transactions) fin_total,
       (select name from halaqat where id = 'da6b10ba-b934-40ce-98d1-e79834c0ecd2') halaqa_name,
       (select count(*) from halaqat where name = 'اسم مغيَّر') halaqa_rows_updated
from _r;
rollback;


-- (م-5) المديرة تعتمد تقرير حلقة بنات ولا تمسّ تقرير حلقة بنين
-- التجهيز: تقرير «حراء» 9/2026 مُرسَل، وتقرير «أبو خضرة» 4/2026 يصير مُرسَلاً
-- المتوقّع: female_status = approved، male_status = submitted (لا يُرى فلا يُعدَّل)
begin;
update profiles set role = 'women_admin', gender = 'female' where id = 'f277ca54-19f8-4118-9998-3da0b6c56a52';
insert into monthly_reports (halaqa_id, report_month, report_year, status) values ('da6b10ba-b934-40ce-98d1-e79834c0ecd2', 9, 2026, 'submitted');
update monthly_reports set status = 'submitted' where id = 'e10022af-27be-4edc-9352-1086e34ff573';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f277ca54-19f8-4118-9998-3da0b6c56a52', 'role', 'authenticated')::text, true);
update monthly_reports set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where halaqa_id = 'da6b10ba-b934-40ce-98d1-e79834c0ecd2' and report_month = 9 and report_year = 2026;
update monthly_reports set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = 'e10022af-27be-4edc-9352-1086e34ff573';
reset role;
select (select status from monthly_reports where halaqa_id = 'da6b10ba-b934-40ce-98d1-e79834c0ecd2' and report_month = 9 and report_year = 2026) female_status,
       (select status from monthly_reports where id = 'e10022af-27be-4edc-9352-1086e34ff573') male_status;
rollback;


-- (م-6) مديرٌ إداريٌّ نشطٌ ثانٍ — يُرفض (والبيانات فيها ثلاثةٌ قدامى من manager)
-- المتوقّع: ERROR 23505 «لا يكون إلا مديرٌ إداريٌّ نشطٌ واحد»
begin;
update profiles set role = 'admin_manager' where id = '9a4ab16b-992e-45b2-a979-3dbff6af2aef';
rollback;


-- (م-7) مديرٌ فنيٌّ نشطٌ ثانٍ — الأول ينجح والثاني يُرفض بالفهرس الفريد الجزئي
-- المتوقّع: ERROR 23505 duplicate key value violates unique constraint "profiles_one_active_technical_manager"
begin;
update profiles set role = 'technical_manager' where id = '9a4ab16b-992e-45b2-a979-3dbff6af2aef';
update profiles set role = 'technical_manager' where id = '808c23f2-736c-4284-aa53-342cefce5080';
rollback;


-- (م-8) المشرف الميداني يغيّر جنسه — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك تعديل الدور أو الحالة أو الرقم الوظيفي أو الجنس»
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '57d4f047-73c5-4dab-89a2-7ebcb4790fc5', 'role', 'authenticated')::text, true);
update profiles set gender = 'female' where id = '57d4f047-73c5-4dab-89a2-7ebcb4790fc5';
rollback;


-- (م-9) المشرف الميداني يُسند طالباً إلى حلقة بنات (أُسند إليها في التجهيز) — يُرفض لاختلاف الجنس
-- المتوقّع: ERROR 23514 «جنس الطالب لا يطابق جنس الحلقة»
begin;
update halaqat set supervisor_id = '57d4f047-73c5-4dab-89a2-7ebcb4790fc5' where id = '61017856-484a-445f-b433-8c45b240e17f';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '57d4f047-73c5-4dab-89a2-7ebcb4790fc5', 'role', 'authenticated')::text, true);
update students set halaqa_id = '61017856-484a-445f-b433-8c45b240e17f' where id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71';
rollback;


-- (م-10) المعلم يغيّر رقم هوية طالبه — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك تعديل هوية الطالب أو جنسه أو حسابه»
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
update students set national_id = '123456789' where id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71';
rollback;


-- (م-11) المعلم يربط طالبه بحساب (user_id) — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك تعديل هوية الطالب أو جنسه أو حسابه»
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
update students set user_id = '808c23f2-736c-4284-aa53-342cefce5080' where id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71';
rollback;


-- (م-12) المعلم يُخرج طالبه من الحلقة (halaqa_id = null) — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك إخراج الطالب من حلقته»
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
update students set halaqa_id = null where id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71';
rollback;


-- (م-13) المعلم يرسل تقرير حلقته (draft→submitted) — ينجح
-- المتوقّع: status = submitted
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
update monthly_reports set status = 'submitted', submitted_at = current_date where id = 'e10022af-27be-4edc-9352-1086e34ff573';
reset role;
select status from monthly_reports where id = 'e10022af-27be-4edc-9352-1086e34ff573';
rollback;


-- (م-14) المعلم يعتمد تقرير حلقته بنفسه — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك اعتماد التقرير»
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
update monthly_reports set status = 'approved' where id = 'e10022af-27be-4edc-9352-1086e34ff573';
rollback;


-- (م-15) المعلم يخفّض درجة التنبيه الموجَّه إليه (final_warning→note) — يُرفض
-- (التجهيز يرفع الدرجة أولاً: التنبيه في البيانات درجتُه note، فالتعديل إليها لا يغيّر شيئاً)
-- المتوقّع: ERROR 42501 «لا تملك إلا الإقرار بالتنبيه»
begin;
update admin_alerts set status = 'new', acknowledged_at = null, severity = 'final_warning' where id = '306a8007-977b-4434-a1f2-0d205f5f335c';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '440cee96-f113-4314-bf53-9d49ef0bcbae', 'role', 'authenticated')::text, true);
update admin_alerts set severity = 'note' where id = '306a8007-977b-4434-a1f2-0d205f5f335c';
rollback;


-- (م-16) المعلم يُقرّ بالتنبيه — ينجح
-- المتوقّع: status = acknowledged، acknowledged_set = true
begin;
update admin_alerts set status = 'new', acknowledged_at = null where id = '306a8007-977b-4434-a1f2-0d205f5f335c';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '440cee96-f113-4314-bf53-9d49ef0bcbae', 'role', 'authenticated')::text, true);
update admin_alerts set status = 'acknowledged', acknowledged_at = now() where id = '306a8007-977b-4434-a1f2-0d205f5f335c';
reset role;
select status, acknowledged_at is not null as acknowledged_set from admin_alerts where id = '306a8007-977b-4434-a1f2-0d205f5f335c';
rollback;


-- (م-17) المختبِر يعدّل ملاحظة نتيجته — ينجح
-- التجهيز: 83d2ae2d يصير examiner، ومختبِرَ «الشافعي»، ومختبِرَ النتيجة 0096e1c3
-- المتوقّع: notes = 'ملاحظة اختبار'
begin;
update profiles set role = 'examiner' where id = '83d2ae2d-5e41-4091-88c8-92ba81b10e36';
update halaqat set examiner_id = '83d2ae2d-5e41-4091-88c8-92ba81b10e36' where id = '6ccc79fb-1a66-4a84-a994-3e8b1e5d03c9';
update exam_results set examiner_id = '83d2ae2d-5e41-4091-88c8-92ba81b10e36' where id = '0096e1c3-0fd1-4337-8f50-bc9d62359142';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '83d2ae2d-5e41-4091-88c8-92ba81b10e36', 'role', 'authenticated')::text, true);
update exam_results set notes = 'ملاحظة اختبار' where id = '0096e1c3-0fd1-4337-8f50-bc9d62359142';
reset role;
select notes from exam_results where id = '0096e1c3-0fd1-4337-8f50-bc9d62359142';
rollback;


-- (م-18) المختبِر يحوّل نتيجته إلى طالبٍ خارج حلقاته (طالب أبو خضرة) — يُرفض
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "exam_results"
begin;
update profiles set role = 'examiner' where id = '83d2ae2d-5e41-4091-88c8-92ba81b10e36';
update halaqat set examiner_id = '83d2ae2d-5e41-4091-88c8-92ba81b10e36' where id = '6ccc79fb-1a66-4a84-a994-3e8b1e5d03c9';
update exam_results set examiner_id = '83d2ae2d-5e41-4091-88c8-92ba81b10e36' where id = '0096e1c3-0fd1-4337-8f50-bc9d62359142';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '83d2ae2d-5e41-4091-88c8-92ba81b10e36', 'role', 'authenticated')::text, true);
update exam_results set student_id = '1bb8a68f-4beb-4a74-b7e5-321945ddee71' where id = '0096e1c3-0fd1-4337-8f50-bc9d62359142';
rollback;


-- (م-19) المعلم يرفع إلى news/ في باكت الوسائط — يُرفض
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "objects"
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('media', 'news/rls-test.png');
rollback;


-- (م-20) المعلم يرفع إلى avatars/ مباشرةً (بلا مجلّد معرّفه) — يُرفض (foldername[2] فارغ)
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "objects"
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('media', 'avatars/rls-test.png');
rollback;


-- (م-21) المعلم يرفع صورته تحت avatars/<معرّفه>/ — ينجح
-- المتوقّع: uploaded = 1
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('media', 'avatars/808c23f2-736c-4284-aa53-342cefce5080/rls-test.png');
reset role;
select count(*) uploaded from storage.objects where name = 'avatars/808c23f2-736c-4284-aa53-342cefce5080/rls-test.png';
rollback;


-- (م-22) المعلم يُطفئ علَم تغيير كلمة المرور لنفسه (true→false) — ينجح
-- المتوقّع: must_change_password = false
begin;
update profiles set must_change_password = true where id = '808c23f2-736c-4284-aa53-342cefce5080';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
update profiles set must_change_password = false where id = '808c23f2-736c-4284-aa53-342cefce5080';
reset role;
select must_change_password from profiles where id = '808c23f2-736c-4284-aa53-342cefce5080';
rollback;


-- (م-23) المعلم يرفع العلَم لنفسه (false→true) — يُرفض
-- المتوقّع: ERROR 42501 «لا تملك رفع علَم تغيير كلمة المرور»
begin;
update profiles set must_change_password = false where id = '808c23f2-736c-4284-aa53-342cefce5080';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '808c23f2-736c-4284-aa53-342cefce5080', 'role', 'authenticated')::text, true);
update profiles set must_change_password = true where id = '808c23f2-736c-4284-aa53-342cefce5080';
rollback;


-- ============================================================================
-- الصورة الشخصية (Task 6b) — الهجرة: supabase/migrations/20261018080234_profile_photos.sql
-- المستودع الخاص profile-photos، والمسار الثابت <profile_id>/photo.webp، ولا صور لحساب أنثى.
--
-- البيانات مُسحت (2026-10-18: حسابٌ واحد، المدير الإداري 1001 ذكر)، فكلُّ بلوكٍ ينشئ حساباته
-- داخل معاملته بصلاحية postgres (auth.users ثم profiles) ثم يُلغيها (rollback):
--   00000000-0000-4000-8000-0000000006b1  معلم ذكر نشط (9601)
--   00000000-0000-4000-8000-0000000006b2  معلم ذكر نشط آخر (9602)
--   00000000-0000-4000-8000-0000000006b3  معلمة أنثى نشطة (9603)
--   00000000-0000-4000-8000-0000000006b4  طالب ذكر نشط (حساب student)
-- النتائج الفعلية مسجَّلة بعد «الفعلي:» (تشغيل 2026-10-18 عبر MCP execute_sql).
-- ============================================================================


-- (ص-1) موظف ذكر يرفع صورته ويثبّت مسارها في صفّه — ينجح (وحارس الأعمدة لا يمنع photo_path)
-- المتوقّع: uploaded = 1، photo_path = '…6b1/photo.webp'
-- الفعلي:   uploaded = 1، photo_path = '00000000-0000-4000-8000-0000000006b1/photo.webp' ✅
begin;
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-0000000006b1','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b1','teacher','معلم اختبار أ','male','active','9601');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b1', 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('profile-photos', '00000000-0000-4000-8000-0000000006b1/photo.webp');
update profiles set photo_path = '00000000-0000-4000-8000-0000000006b1/photo.webp' where id = '00000000-0000-4000-8000-0000000006b1';
reset role;
select (select count(*) from storage.objects where bucket_id = 'profile-photos' and name = '00000000-0000-4000-8000-0000000006b1/photo.webp') uploaded,
       (select photo_path from profiles where id = '00000000-0000-4000-8000-0000000006b1') photo_path;
rollback;


-- (ص-2) موظف ذكر يرفع في مجلّد موظفٍ آخر — يُرفض
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "objects"
-- الفعلي:   ERROR 42501 new row violates row-level security policy for table "objects" ✅
begin;
insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-0000000006b1','authenticated','authenticated'),
  ('00000000-0000-4000-8000-0000000006b2','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b1','teacher','معلم اختبار أ','male','active','9601'),
  ('00000000-0000-4000-8000-0000000006b2','teacher','معلم اختبار ب','male','active','9602');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b1', 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('profile-photos', '00000000-0000-4000-8000-0000000006b2/photo.webp');
rollback;


-- (ص-3) معلمة (أنثى) ترفع صورتها — يُرفض (سياسة المستودع)
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "objects"
-- الفعلي:   ERROR 42501 new row violates row-level security policy for table "objects" ✅
begin;
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-0000000006b3','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b3','teacher','معلمة اختبار','female','active','9603');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b3', 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('profile-photos', '00000000-0000-4000-8000-0000000006b3/photo.webp');
rollback;


-- (ص-4) معلمة (أنثى) تكتب مساراً في صفّها مباشرةً — يُرفض (قيد الجدول)
-- المتوقّع: ERROR 23514 new row for relation "profiles" violates check constraint "profiles_photo_path_shape"
-- الفعلي:   ERROR 23514 … violates check constraint "profiles_photo_path_shape" ✅
begin;
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-0000000006b3','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b3','teacher','معلمة اختبار','female','active','9603');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b3', 'role', 'authenticated')::text, true);
update profiles set photo_path = '00000000-0000-4000-8000-0000000006b3/photo.webp' where id = '00000000-0000-4000-8000-0000000006b3';
rollback;


-- (ص-5) المدير الإداري يرفع صورة موظفٍ ذكر ويثبّت مسارها — ينجح
-- (المعرّف يُقرأ قبل الانتحال: المدير الإداري النشط الوحيد)
-- المتوقّع: uploaded = 1، photo_path = '…6b1/photo.webp'
-- الفعلي:   uploaded = 1، photo_path = '00000000-0000-4000-8000-0000000006b1/photo.webp' ✅
begin;
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-0000000006b1','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b1','teacher','معلم اختبار أ','male','active','9601');
select set_config('request.jwt.claims', json_build_object('sub', (select id from profiles where role = 'admin_manager' and status = 'active'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into storage.objects (bucket_id, name) values ('profile-photos', '00000000-0000-4000-8000-0000000006b1/photo.webp');
update profiles set photo_path = '00000000-0000-4000-8000-0000000006b1/photo.webp' where id = '00000000-0000-4000-8000-0000000006b1';
reset role;
select (select count(*) from storage.objects where bucket_id = 'profile-photos' and name = '00000000-0000-4000-8000-0000000006b1/photo.webp') uploaded,
       (select photo_path from profiles where id = '00000000-0000-4000-8000-0000000006b1') photo_path;
rollback;


-- (ص-6) الطالب لا يرى كائنَ صورة غيره (فلا يولّد له رابطاً موقَّعاً)، ويرى صورته؛ والموظف يرى الاثنين
-- المتوقّع: student → other_seen = 0، own_seen = 1 ؛ staff → other_seen = 1، own_seen = 1
-- الفعلي:   student → 0، 1 ؛ staff → 1، 1 ✅
begin;
insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-0000000006b1','authenticated','authenticated'),
  ('00000000-0000-4000-8000-0000000006b2','authenticated','authenticated'),
  ('00000000-0000-4000-8000-0000000006b4','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b1','teacher','معلم اختبار أ','male','active','9601'),
  ('00000000-0000-4000-8000-0000000006b2','teacher','معلم اختبار ب','male','active','9602'),
  ('00000000-0000-4000-8000-0000000006b4','student','طالب اختبار','male','active',null);
insert into storage.objects (bucket_id, name) values
  ('profile-photos', '00000000-0000-4000-8000-0000000006b1/photo.webp'),
  ('profile-photos', '00000000-0000-4000-8000-0000000006b4/photo.webp');
create temp table _r (who text, other_seen bigint, own_seen bigint) on commit drop;
grant all on _r to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b4', 'role', 'authenticated')::text, true);
insert into _r select 'student',
  (select count(*) from storage.objects where bucket_id = 'profile-photos' and name = '00000000-0000-4000-8000-0000000006b1/photo.webp'),
  (select count(*) from storage.objects where bucket_id = 'profile-photos' and name = '00000000-0000-4000-8000-0000000006b4/photo.webp');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b2', 'role', 'authenticated')::text, true);
insert into _r select 'staff',
  (select count(*) from storage.objects where bucket_id = 'profile-photos' and name = '00000000-0000-4000-8000-0000000006b1/photo.webp'),
  (select count(*) from storage.objects where bucket_id = 'profile-photos' and name = '00000000-0000-4000-8000-0000000006b4/photo.webp');
reset role;
select * from _r;
rollback;


-- (ص-7) اسمٌ جذريّ بلا مجلّد (`photo.webp`) — يُرفض (foldername فارغ ⇒ coalesce ⇒ false)
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "objects"
-- الفعلي:   ERROR 42501 … for table "objects" ✅
begin;
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-0000000006b1','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b1','teacher','معلم اختبار أ','male','active','9601');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b1', 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('profile-photos', 'photo.webp');
rollback;


-- (ص-8) صاحب الصورة ينقلها إلى اسمٍ حرّ — يُرفض (with check يفرض الاسم الثابت)
-- المتوقّع: ERROR 42501 new row violates row-level security policy for table "objects"
-- الفعلي:   ERROR 42501 … for table "objects" ✅
begin;
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-0000000006b1','authenticated','authenticated');
insert into profiles (id, role, full_name, gender, status, employee_number) values
  ('00000000-0000-4000-8000-0000000006b1','teacher','معلم اختبار أ','male','active','9601');
insert into storage.objects (bucket_id, name) values ('profile-photos', '00000000-0000-4000-8000-0000000006b1/photo.webp');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000006b1', 'role', 'authenticated')::text, true);
update storage.objects set name = '00000000-0000-4000-8000-0000000006b1/selfie.jpg'
 where bucket_id = 'profile-photos' and name = '00000000-0000-4000-8000-0000000006b1/photo.webp';
rollback;
