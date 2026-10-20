-- تنظيفٌ قبل الإطلاق (مستشار أمان Supabase): دوالُّ مشغّلاتٍ SECURITY DEFINER في public كان يستطيع `anon`
-- و`authenticated` استدعاءها عبر /rest/v1/rpc — منحُ Supabase الافتراضيّ يعطيهما EXECUTE مباشرةً.
-- المشغّلُ لا يحتاج المنح (يُفحص EXECUTE عند إنشاء المشغّل لا عند إطلاقه)، ولا سياسةَ ولا شرطَ مشغّلٍ يستعمل أيّاً منها
-- (فُحص pg_policy وتعريفات المشغّلات). `rls_auto_enable` دالّةُ event trigger غيرُ مربوطة.
-- مُختبَرٌ بعد السحب في معاملةٍ ملغاة بجلسات الأدوار: المشغّلاتُ تعمل والحرّاسُ ترفض كما كانت.

revoke execute on function public.bump_parts_on_pass() from anon, authenticated;
revoke execute on function public.guard_alert_update() from anon, authenticated;
revoke execute on function public.guard_profile_privileged() from anon, authenticated;
revoke execute on function public.guard_report_status() from anon, authenticated;
revoke execute on function public.guard_statement_status() from anon, authenticated;
revoke execute on function public.guard_student_assignment() from anon, authenticated;
revoke execute on function public.stamp_halaqa_examiner() from anon, authenticated;
revoke execute on function public.sync_student_gender_to_profile() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
