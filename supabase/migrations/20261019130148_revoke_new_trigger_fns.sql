-- دوالُّ المشغّلات الثلاث الجديدة (توثيقُ بنود الحوافز والزيارات): منحُ Supabase الافتراضيّ يعطي anon و authenticated
-- حقَّ EXECUTE مباشرةً فلا يكفيه `revoke … from public` (نبّه إليه مستشار الأمان). المشغّلُ لا يحتاج المنح —
-- مُختبَرٌ بعد السحب في معاملةٍ ملغاة: الحارسُ يرفض تغيير الموعد بلا سبب، والتأجيلُ بسببٍ يمرّ.
revoke execute on function public.guard_statement_item_date() from anon, authenticated;
revoke execute on function public.guard_visit_reschedule() from anon, authenticated;
revoke execute on function public.derive_visit_status() from anon, authenticated;
