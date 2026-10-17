-- دور المختبِر (ROADMAP #32) — القيمة وحدها في هجرةٍ مستقلّة:
-- ALTER TYPE … ADD VALUE لا تُستعمَل قيمتُها الجديدة في المعاملة نفسها.
alter type public.user_role add value if not exists 'examiner';
