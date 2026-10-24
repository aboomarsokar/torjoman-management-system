# خطة إطلاق ترجمان (الشهر 11-2026)

> أُعدّت 20-10-2026. **لا يُنفَّذ الحذف إلا بتأكيدٍ صريحٍ من المستخدم لحظة التنفيذ.** الترتيب: قراراتٌ ← نسخةٌ احتياطية ← حذفٌ ← إدخالٌ حقيقيّ ← فحوص اليوم الأول.

## ١. قراراتٌ قبل الحذف

| القرار | الخيارات | الافتراض المقترح |
|---|---|---|
| السجلّات غيرُ الموسومة «تجريبي» | الموظف «اختبار» (1015، معلم) · المختبِر «فتحي» (1013) · الطالبان «عدلي» (401236547) و«سامي» (123456789) · حلقة «هاشم» · خبرٌ عنوانه «ح» | تجريبيةٌ كلُّها فتُحذف |
| ما يبقى | المدير الإداري 1001 (محمد سالم أديب سكر) والمدير الفني 1002 (عبد الرحيم أحمد حسين عابد) | يبقيان بحسابيهما وكلمتيهما |
| الأرقام الوظيفية | **قرار المستخدم 2026-10-20: تُعاد فيبدأ الحقيقيون من 1003** — تُنفَّذ مع الحذف لا قبله (الأرقام 1003–1015 مشغولةٌ بحسابات التجريب) | `setval` في نصّ الحذف أدناه |
| حمايةُ كلمات المرور المسرّبة | لوحة Supabase ← Authentication ← Settings ← «Leaked password protection» | **يفعّلها المستخدم بنفسه** (قراره 2026-10-20) |
| موعد الحذف | **نُفِّذ 2026-10-22 بتأكيد المستخدم** (أُضيفت إلى النصّ الجداولُ المستجدّة بعد 20-10: `visit_deduction_items` — **خطأً، وهو مرجعيّ؛ انظر التحذير في §٣** — و`teacher_quality_months` و`reading_attempts` و`booklet_deliveries` و`impersonation_sessions`/`writes`، وجُرّب في معاملةٍ ملغاة أوّلاً) | — |
| الإدخالُ الحقيقيّ | **نُفِّذ 2026-10-22** من «نموذج جمع بيانات العاملين»: 43 حساباً (1003–1045) + تحديثُ 1001 و1002، وكلُّ حقول الاستمارة وحسابُ جوال باي (`profile_financials`)، و36 حلقةً باسم «المعلم — المكان» وموعدِها (3 بلا موعد: 05:00 و00:30 و«متغير»)، بلا مشرفٍ ولا مختبِرٍ ولا طلاب | — |
| الإعدادات | علامةُ الاجتياز وأهداف الحفظ في `app_settings` | تُراجَع قبل أوّل اختبار |

## ٢. النسخةُ الاحتياطية

- المشروع على خطة **Pro**: نسخةٌ يوميةٌ تُحفظ سبعة أيام (لوحة Supabase ← Database ← Backups). تُفحص أنّ نسخة اليوم موجودة **قبل** الحذف.
- النسخةُ لا تشمل **ملفّات المستودعات** (الصور الشخصية وفواتير المصروفات). قبل الإطلاق لا ملفّاتٍ حقيقية فيها؛ بعده يُصدَّر مستودع `finance-docs` شهرياً.

## ٣. حذفُ البيانات التجريبية (معاملةٌ واحدة)

الجرد في 20-10-2026: 40 حساباً (38 تُحذف)، 5 حلقات، 26 طالباً، 3 زيارات، 4 كشوف حوافز، 3 رواتب، حركتان ماليتان، تنبيهان، خبر، يومُ حضور، إشعار، و4 ملفّات في المستودعات. الجداولُ المرجعية تبقى كما هي: `surahs` و`quran_pages` و`program_juz` و`exam_cycles` و`app_settings` و`visit_deduction_items` و`reading_units` و`reading_unit_parts` و`reading_books` و`reading_questions`.

> ⚠️ **كلُّ جدولٍ تبذره هجرةٌ (`insert into … values` في `supabase/migrations/`) مرجعيٌّ لا يدخل نصَّ الحذف.** في تنفيذ 2026-10-22 أُضيف `visit_deduction_items` إلى النصّ مع الجداول المستجدّة فأُفرغت بنودُ الخصم الأربعة عشر، فظهر نموذجُ الزيارة بلا معايير وكلُّ حفظٍ 42 من 42؛ أعادتها `20261024102631_restore_visit_deduction_items.sql` (طُبّقت 2026-10-24، ولم تكن زيارةٌ قد حُفظت نتيجتُها). قبل أيّ حذفٍ قادم: `grep -ohiE "insert into public\.[a-z_]+" supabase/migrations/*.sql | sort -u` ومقابلةُ القائمة بالنصّ، وفي فحص ما قبل الالتزام عددُ صفوف كلّ جدولٍ مرجعيّ لا صفر.

```sql
begin;
-- يبقى المديران وحدهما
create temp table keep_ids on commit drop as
  select id from public.profiles where employee_number in ('1001', '1002');
do $$ begin
  if (select count(*) from keep_ids) <> 2 then raise exception 'لم يُعثر على 1001 و1002 — توقّف'; end if;
end $$;

delete from public.notifications;
delete from public.admin_alerts;
delete from public.visit_reschedule_log;
delete from public.supervision_visits;
delete from public.attendance_absences;
delete from public.attendance_days;
delete from public.quran_records;
delete from public.monthly_reports;
delete from public.exam_results;
delete from public.exam_list_items;
delete from public.exam_lists;
delete from public.incentive_statement_items;
delete from public.incentive_statements;
delete from public.halaqa_incentives;
delete from public.transaction_attachments;
delete from public.financial_transactions;
delete from public.monthly_salaries;
delete from public.transport_trips;
delete from public.news;
delete from public.meeting_minutes;
delete from public.students;
delete from public.halaqat;
delete from public.profiles where id not in (select id from keep_ids);  -- profile_financials تُحذف بالتتالي
delete from auth.users where id not in (select id from keep_ids);
-- الأرقام من 1003 (قرار المستخدم 2026-10-20):
select setval('public.employee_number_seq', 1002);

-- تحقّق قبل الالتزام: كلّها أصفار إلا الحسابين
select (select count(*) from public.profiles) profiles, (select count(*) from auth.users) users,
       (select count(*) from public.students) students, (select count(*) from public.halaqat) halaqat;
commit;
```

> **جُرّب النصّ كاملاً في معاملةٍ ملغاة (20-10-2026):** مرّ بلا خطأ ربط، وبقي الحسابان 1001 و1002 وحدهما، وكلُّ ما سواهما صفر.

ثم تُحذف ملفّات المستودعات (لا تُحذف بـSQL): `profile-photos` للحسابات المحذوفة، وصورةُ الخبر في `media` — من لوحة Supabase ← Storage، أو بأداةٍ يشغّلها Claude.
وتُحذف بعدها ملفّاتُ `torjoman/.test-accounts.local` و`.test-data-manifest.local`، وتُغيَّر حالةُ وثيقة «سيناريوهات تجريب ترجمان» إلى «انتهى التجريب».

## ٤. إدخالُ البيانات الحقيقية

1. **الموظفون** — جدولٌ بالأعمدة: الاسم، الدور (معلم/معلمة/مشرف ميداني/مشرفة ميدانية/مختبر/مختبرة/المديرة الإدارية/مشرف المشروع)، الجنس (ذكر/أنثى)، الهاتف.
   `node scripts/bulk-accounts.mjs staff موظفون.csv` (فحصٌ فقط) ← ثم `--apply`. الكلماتُ المؤقّتة في ملفّ `bulk-credentials-staff-….local` يفتح في Excel.
2. **الحلقات** — من شاشة الحلقات (الجنسُ أوّلاً فيقترح المعلمين والمشرفين والمختبِرين من جنسها).
3. **الطلاب** — جدولٌ بالأعمدة: الاسم، الجنس، رقم الهوية، الحلقة (اسمها كما في المنصّة)، تاريخ الميلاد، هاتف وليّ الأمر.
   `node scripts/bulk-accounts.mjs students طلاب.csv` ← ثم `--apply`. يرفض الفحصُ الهويةَ المكرّرة (في الملفّ أو في المنصّة) والحلقةَ غيرَ الموجودة والجنسَ المخالف لها، ولا يكتب شيئاً حتى يصحّ الملفّ كلُّه.
4. **التوزيع** — المدير الإداري يعطي كلَّ شخصٍ رقمه وكلمته المؤقّتة، ثم يُحذف ملفّ الكلمات. كلٌّ يغيّر كلمته عند أوّل دخول.

## ٥. فحوص اليوم الأول

- دخولُ حسابٍ من كلّ دور، وتغييرُ الكلمة المؤقّتة.
- المعلم: فتحُ يوم الحضور وتعليمُ غائب؛ والمشرف: جدولةُ زيارة.
- الجرس: إشعارٌ يصل بلا تحديث.
- الجوال: المنصّة تُفتح بآخر نسخة من أول مرّة (لا شاشة قديمة).
- سجلّ Supabase: لا طلباتٍ مرفوضة (400/403) غيرَ كلمات المرور الخاطئة.

## الأداء (قيس 20-10-2026)

محاكاةُ 600 طالبٍ في معاملةٍ ملغاة: قراءةُ الجداول الاثني عشر المحميّة بالحلقة صارت 11ms للمعلّم والمشرف و8ms للمدير بعد هجرة `visible_halaqa_ids` (كانت 283ms و627ms و152ms). لا عائقَ أداءٍ معروفٌ للإطلاق.
