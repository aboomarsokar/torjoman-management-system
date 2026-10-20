# الدخول بالنيابة (الجزء ٥) — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** يدخل المديرُ الإداريّ والمديرُ الفنيّ بحساب موظفٍ ليرى شاشته كما يراها، **قراءةً فقط تحرسها القاعدة**، ويفتح عند الحاجة **وضعَ تعديلٍ عشرَ دقائق** تُسجَّل كلُّ كتابةٍ فيه بصورتَي الصفّ؛ ويصل الموظفَ إشعارٌ عند البدء وآخرُ عند فتح التعديل؛ وينتهي بالعودة إلى حساب المدير.

**Architecture:** جلسةُ Supabase **حقيقية** للهدف يفتحها الخادم (`generateLink` + `verifyOtp` بعميلٍ منفصل) وتُوسَم بـ`session_id` في `impersonation_sessions` — **الوسمُ على الجلسة لا على الحساب**، فالموظف يعمل في جلسته في اللحظة نفسها بلا أثر. الحراسةُ في ثلاث طبقات: (١) **سياساتٌ تقييديّة (`as restrictive`)** على كلّ جدولٍ في `public` وعلى `storage.objects` تنادي `private.assert_session_writable()`؛ (٢) حرسٌ في بدن الدوالّ `security definer` الكاتبة؛ (٣) `requireWritableSession` في كلّ مسارٍ خادميّ يكتب بـ`service_role` مع اختبارٍ يمسح `server/api`. وحارسٌ رابعٌ على `auth.users` يمنع تغيير كلمة المرور/البريد بجلسة نيابة (GoTrue خارج RLS). مُنتِجا الإشعار مُشغِّلان على `impersonation_sessions` (تكتبه `service_role` فـ`auth.uid()` فارغ ولا يُسقطه شرطُ «لا يُشعَر أحدٌ بفعله»).

**Tech Stack:** Nuxt 4 · @nuxt/ui v4 · TypeScript strict · @nuxtjs/supabase 2.0.9 (`serverSupabaseUser` = ادّعاءات JWT عبر `getClaims`) · Supabase Postgres (RLS، `private`، `security definer`) · Vitest · pnpm.

**المواصفة:** `docs/superpowers/specs/2026-10-19-v2-batch2-design.md` — «الجزء ٥» و«عقدُ العمود الفقريّ» (ب، ج، د، هـ) و§0. **المرجع المنقول منه (قراءةٌ فقط، لا يُعدَّل أبداً):** `~/Developer/sahaba-schools` — `server/utils/impersonationScope.ts`، `server/utils/impersonationGuard.ts`، `server/utils/auth.ts` (`canWrite`)، `server/api/admin/impersonate*.ts`، `server/api/me/impersonation.get.ts`، `app/composables/useImpersonation.ts`، `app/components/app/ImpersonationBar.vue`، الهجرات `20260911130000…160000` و`20260921120000/130000` و`20260922180000` و`20260930142138`، والاختبار `server/utils/impersonationGuardCoverage.test.ts`.

> **تعديلاتٌ عند التخطيط (2026-10-20) على المواصفة وعلى نقل الصحابة — بعللها:**
> 1. **الحارسُ سياساتٌ تقييديّةٌ تُضاف لا إعادةُ كتابةٍ للسياسات القائمة.** في الإنتاج 11 سياسةً `FOR ALL`، وأربعٌ منها (`fintx_all`، `fin_all`، `salaries_all`، `minutes_all`) **هي طريقُ القراءة الوحيد لمشرف المشروع** (لا سياسة `SELECT` مستقلّة) — فإلحاقُ `and not …` بـ`USING` فيها (نمط الصحابة) **يُعمي مشرفَ المشروع المُناب عنه عن المالية والرواتب والمحاضر**. والسياسةُ التقييديّة لكلّ أمرٍ (`insert/update/delete`) لا تمسّ نصّاً قائماً، فتبقى صيغُ `visible_halaqa_ids` وفروعُ الطالب المنقول حرفاً كما هي، وتشمل **كلَّ سياسةٍ تُضاف غداً على جدولٍ محروس** تلقائياً. ويبقى شرطُ المواصفة («تتوقّف إن بقيت سياسةٌ بلا حارس أو تغيّرت أدوارُ سياسة») بصيغةٍ أقوى: لقطةُ كلّ السياسات القائمة قبلُ = بعدُ حرفاً، وكلُّ جدولٍ فيه سياسةُ كتابةٍ مسموحة محروسٌ بثلاث.
> 2. **الحارسُ يرفع خطأً عربياً لا يُصفّي صامتاً:** `private.assert_session_writable()` ترمي `42501` بنصّ `IMPERSONATION_READ_ONLY_MESSAGE` — فتحديثٌ بالنيابة لا يعود «0 صفوف» فيقول الكودُ «قد تكون الرحلةُ سُدّدت»، بل يقول الحقيقة. (`useErrorHandler` يعرض العربيّ كما هو.)
> 3. **`private.revoke_sessions(p_user_ids)` القائمة لا تصلح:** تحذف **كلَّ** جلسات المستخدم (فتُخرج الموظفَ من هاتفه). تُبنى `private.end_impersonation_sessions(p_session_ids uuid[])` بالمعرّف وتشترط أن تكون الجلسةُ نيابةً مسجَّلة، ووجهٌ لها في `public` لـ`service_role` وحده (PostgREST لا يبلغ `private` — §0 — وكشفُ المخطّط كلّه لأجل دالّةٍ واحدة يوسّع السطح).
> 4. **`auth.admin.signOut(token)` في الصحابة نطاقُها الافتراضيّ `global`** — تُخرج الموظفَ من كلّ أجهزته. هنا: `signOut(token, 'local')` حيث لا صفَّ بعد، و`end_impersonation_sessions` حيث الصفّ موجود.
> 5. **ثغرةٌ لم تُعالجها الصحابة:** جلسةُ النيابة تملك `supabase.auth.updateUser({ password | email })` — وهذا خارج RLS. والمديرُ الفنيّ **لا يملك إعادة تعيين كلمات المرور** (المصفوفة) فكان سيستولي على أيّ حسابٍ من أدوات المتصفّح. الحلّ: مُشغِّلٌ على `auth.users` يرفض تغيير بيانات الدخول ما دامت للهدف جلسةُ نيابةٍ حيّة (Task 1)، وإخفاءُ «تغيير كلمة المرور» وحاجزُ `/change-password` في الواجهة (Task 4).
> 6. **الخروج أثناء النيابة:** `supabase.auth.signOut()` بلا نطاق = `global` = يُخرج الموظفَ الحقيقيّ من كلّ أجهزته. يصير في النيابة: إنهاءٌ على الخادم ثم `signOut({ scope: 'local' })`.

## Global Constraints

- **مكان العمل:** شجرة العمل `/Users/aboomar/Developer/torjoman-v2b2` على `feature/v2-batch2` وحدها؛ لا يُلمس `/Users/aboomar/Developer/torjoman` ولا `~/Developer/sahaba-schools` (قراءةٌ فقط). لا دفع ولا دمج إلا بإذن المستخدم. خادم التطوير حيّ على 3030 من هذه الشجرة: **لا `nuxt build` ولا `pnpm typecheck`** — بل `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` و`-p .nuxt/tsconfig.server.json` للقراءة (الخطأ القائم سلفاً: `app/pages/students/index.vue` ~235 وحده). و`vue-tsc` لا يمسك إعادة التعريف في SFC — الحَكَم فتحُ الصفحة وسجلُّ الخادم.
- **الترتيب إلزاميّ:** Task 1 ← Task 2 ← (Task 3 و4). **لا تُبدأ نيابةٌ حقيقيةٌ قبل تطبيق Task 2** (قبلها جلسةُ النيابة كاملةُ الكتابة). الهجرات تُطبَّق على الإنتاج فوراً (القاعدة مشتركة) لكنّها خاملةٌ بلا مسارات Task 3.
- **القرارات المعتمدة (المستخدم 2026-10-19):** قراءةٌ فقط افتراضاً + وضعُ تعديلٍ **عشر دقائق** (لا يتجاوز `expires_at`) **للمدير الإداري والمدير الفني كليهما**؛ الجلسة 30 دقيقة؛ الموظف يُشعَر بـ`impersonation_started` عند البدء و`impersonation_write` عند فتح التعديل (النوعان قائمان في `notifications_kind_check` و`private.notify` و`NOTIFICATION_KINDS` — **لا يُعاد تعريف القيد**).
- **النطاق (قائمةٌ بيضاء لا نفيُ دور — درس «حراسةُ نفيِ دورٍ واحد»):** المدير الإداري ← `project_supervisor`، `technical_manager`، `women_admin`، `field_supervisor`، `examiner`، `teacher` (نشطون)؛ المدير الفني ← نفسُها بلا `technical_manager` (نظيرُه = نفسُه، والفهرس الفريد يجعله واحداً). لا أحد عن `admin_manager` ولا عن `student` ولا عن نفسه، **ولا نيابة داخل نيابة** (`caller.isImpersonating → 403` أوّلاً — ثغرةُ الصحابة: المدير الإداري ينوب عن المدير الفني، فتصير الجلسةُ «مديراً فنياً» يبدأ نيابةً ثانية).
- **القاعدة:** دوالُّ النيابة في `private` (غير مكشوف)؛ كلُّ دالّةٍ في سياسةٍ أو في شرط `WHEN` تُمنح لـ`authenticated` **و`service_role`** (درس «شرطُ المُشغِّل يحتاج منحاً» — أسقط الكتابة على 56 جدولاً في الصحابة)؛ دوالُّ المشغّلات بلا `EXECUTE` لـ`anon`/`authenticated`؛ `security definer` + `set search_path = ''`؛ كلُّ دالّةٍ جديدة في `public` تُسحب من `public, anon, authenticated` صراحةً (د)؛ كلُّ هجرةٍ تفحص نفسها في كتلة `do`؛ **اسمُ الملف = نسختُه الفعليّة** بعد `apply_migration` (من `list_migrations`)؛ التحقّقُ السلوكيّ في كتلة `do` تنتهي بـ`raise exception 'rollback-ok: …'` **قبل** التطبيق؛ **أجسامُ الدوالّ والسياسات تُقرأ من الإنتاج** (`pg_get_functiondef`/`pg_policies`) لا من الملفّات (درس «تباعُدُ الإنتاج عن ملفّات الهجرات»).
- **`current_user_role()` تشترط وجود `session_id` في `auth.sessions`** — فجلسةُ النيابة جلسةٌ حقيقية، والتحقّقُ السلوكيّ يُدرج صفّ `auth.sessions` مؤقّتاً داخل الكتلة الملغاة. والعميلُ يبدّل الجلسة بـ`refreshSession({ refresh_token })` **لا `setSession`** (ترمي بلا `access_token`) ثم `window.location.replace` (الذاكرة تحمل ملفَّ المدير).
- **الأنواع** تُولَّد بعد كلّ هجرةٍ تمسّ `public`: `generate_typescript_types` ← ملفٌّ مؤقّت في المسوّدة ← فرقٌ **إضافيٌّ فقط** ← يُستبدل `app/types/database.types.ts`.
- كلُّ نصٍّ عربيّ، **الشهور والأوقات بالأرقام اللاتينية** (`DD-MM-YYYY`، `HH:MM` بتوقيت غزة)، RTL، لمس ≥ 44px، لا ألوان مباشرة (توكنز `main.css`)، JSDoc عربيّ أعلى كلّ ملف، ملفات ≤ 300 سطر (`users/index.vue` 511 و`profile/[id].vue` 641 سلفاً — **لا يُزاد فيهما إلا سطورُ استدعاء مكوّن**).
- `pnpm lint && pnpm test` خضراء قبل كلّ إيداع؛ رسائل Conventional عربية تنتهي بسطرٍ فارغ ثم `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## خطُّ الأساس من الإنتاج (قُرئ 2026-10-20، `qwtqfkayupzijcoguqrf`)

- **سياساتُ الكتابة: 55** — في `public` **47** على 25 جدولاً (13 INSERT · 12 UPDATE · 11 DELETE · **11 ALL**)، وفي `storage.objects` **8** (3 INSERT · 2 UPDATE · 3 DELETE)؛ كلُّها `PERMISSIVE` و`to authenticated`، ولا شيء منها `to public`.
  - جداولُ `public` ذاتُ سياسات الكتابة (25): `admin_alerts`، `app_settings`، `attendance_absences`، `attendance_days`، `exam_cycles`، `exam_list_items`، `exam_lists`، `exam_results`، `financial_transactions`، `halaqa_incentives`، `halaqat`، `incentive_statement_items`، `incentive_statements`، `meeting_minutes`، `monthly_reports`، `monthly_salaries`، `news`، `profile_financials`، `profiles`، `quran_records`، `students`، `supervision_visits`، `transaction_attachments`، `transport_trips`، `visit_reschedule_log`.
  - بلا سياسة كتابة (4): `notifications` (تكتبها دوالّ definer)، `surahs`، `quran_pages`، `program_juz`. **كلُّ جداول `public` الـ29 عليها RLS**، ومالكُها `postgres`، ولا `FORCE RLS`.
  - سياساتُ `ALL` التي هي طريقُ القراءة الوحيد (لا `SELECT` مستقلّة): `financial_transactions.fintx_all`، `profile_financials.fin_all`، `monthly_salaries.salaries_all`، `meeting_minutes.minutes_all` — **سببُ القرار ١ أعلاه**.
  - المستودعات: `finance_docs_{insert,delete}`، `media_write_{insert,update,delete}`، `profile_photos_{insert,update,delete}`.
- **الدوالّ `security definer` الكاتبة التي يستدعيها العميل (3) — تحتاج حرسَ البدن:** `public.mark_notifications_read(uuid[])`، `public.set_transport_paid(uuid[], boolean)`، `public.update_my_contact(text,text,text,text)`.
  - كاتبةٌ لا يستدعيها العميل (لا حرس — تعمل بعد كتابةٍ سمحت بها RLS أو بيد الخادم): `private.notify`، `private.refresh_transport_notice`، `private.revoke_sessions` (لـ`service_role`)، و9 دوالّ مشغّلات: `private.notify_alert_issued`، `notify_exam_graded`، `notify_exam_nominated`، `notify_report_status`، `notify_statement_returned`، `notify_visit_scheduled`، `on_student_transfer`، `sync_student_account_status`، و`public.bump_parts_on_pass`.
  - كاتبتان بصلاحية المنادي (`invoker` — تحرسهما السياساتُ التقييديّة تلقائياً): `public.reschedule_visit`، `public.return_statement`. و`public.claim_employee_number()` تسلسلٌ لـ`service_role` وحده (ليست كتابةَ جدول).
- **مساراتُ الخادم التي تكتب بـ`service_role`: 5** — كلُّها خلف `requireAdminManager` (`server/utils/supabaseAdmin.ts`):
  1. `server/api/users.post.ts` (`auth.admin.createUser`، `profiles.insert`، `rpc('claim_employee_number')`، `auth.admin.deleteUser` تراجعاً)
  2. `server/api/students.post.ts` (`auth.admin.createUser`، `profiles.insert`، `students.insert`، تراجعاتٌ بـ`delete`/`deleteUser`)
  3. `server/api/users/reset-password.post.ts` (`profiles.update`، `auth.admin.updateUserById`)
  4. `server/api/students/[id].delete.ts` (`profiles.delete`، `auth.admin.deleteUser`، `students.delete`)
  5. `server/api/students/[id]/national-id.patch.ts` (`auth.admin.updateUserById`، `students.update`)
  - قراءةٌ فقط بـ`service_role`: `server/api/public/student/[token].get.ts`. (وكلُّ الخمسة اليوم مغلقةٌ عملياً في النيابة لأنّ الهدف لا يكون مديراً إدارياً أبداً — والحارسُ دفاعٌ ثانٍ يصمد يوم يُفتح مسارٌ لدورٍ آخر.)
- **وقائع أخرى:** `private.revoke_sessions(p_user_ids uuid[]) returns integer` لـ`service_role` وحده؛ المُشغِّل `profiles_revoke_sessions` (`private.revoke_on_account_change`) يُبطل **كلَّ** جلسات الحساب عند تعطيله أو تغيير دوره أو رفع `must_change_password` — **فيُبطل جلسةَ النيابة معها** (مقصود). لا مُشغِّل على `auth.users` اليوم. `pg_cron` **متاح غيرُ مفعَّل**. `notifications` وحدَه في `supabase_realtime`. عاملُ الخدمة (PWA) يخزّن هيكلَ التطبيق وحده (`navigateFallback: null`، لا استدعاءات Supabase)، و`localStorage` لإخفاء شريط التثبيت وحدَه.

## خريطة الملفات

| الملف | المسؤولية |
|---|---|
| `supabase/migrations/<v>_impersonation_core.sql` | `impersonation_sessions`، `impersonation_writes`، `private.is_impersonating/session_is_read_only/assert_session_writable`، `private.log_impersonation_write`، مُنتِجا الإشعار، `end_impersonation_sessions` (private + وجه public)، حارسُ بيانات الدخول على `auth.users` |
| `supabase/migrations/<v>_impersonation_read_only_sweep.sql` | `private.guard_table_for_impersonation(regclass, boolean)`؛ تطبيقُها على كلّ جداول `public` و`storage.objects`؛ حرسُ بدن الدوالّ الثلاث؛ الفحصُ الذاتيّ |
| `supabase/migrations/<v>_impersonation_expiry_sweep.sql` | **(بإذن المستخدم — قرار ٢)** `pg_cron` يكنس الجلسات المنتهية كلَّ 5 دقائق |
| `app/constants/impersonation.ts` (+test) | الرسالة، المدّتان، `IMPERSONATOR_ROLES`، `IMPERSONATION_TARGETS` (مصدرٌ واحد للخادم والواجهة) |
| `server/utils/caller.ts` (+test) | `requireCaller` (الدور + صفّ النيابة معاً)، `sessionCanWrite` |
| `server/utils/impersonationGuard.ts` | `requireWritableSession` |
| `server/utils/impersonationScope.ts` (+test) | `assertMayImpersonate`، `impersonationReturnTo`، `parseImpersonateInput`، `parseWriteModeInput`، `sessionIdFromAccessToken` |
| `server/utils/impersonationSession.ts` | `openSessionFor(userId)` — `getUserById` ← `generateLink` ← `verifyOtp` بعميلٍ منفصل |
| `server/utils/supabaseAdmin.ts` | `requireAdminManager` يبني على `requireCaller` ويُرجع `caller` |
| `server/api/impersonate.post.ts` · `impersonate/end.post.ts` · `impersonate/write-mode.post.ts` · `me/impersonation.get.ts` | المسارات الأربعة |
| `server/api/{users.post,students.post,users/reset-password.post,students/[id].delete,students/[id]/national-id.patch}.ts` | `requireWritableSession(caller)` |
| `server/utils/impersonationGuardCoverage.test.ts` · `server/utils/impersonationRoutes.test.ts` · `server/utils/impersonationDbGuards.test.ts` | تغطيةُ الحارس، حراساتُ المسارات نصّاً، وحرسُ الهجرات القادمة |
| `app/utils/impersonation.ts` (+test) | الساعة والعدّ التنازليّ ونافذة الكتابة والانتهاء ونصّ التأكيد — نقيّ |
| `app/composables/useImpersonation.ts` (+test) | الحالة من الخادم، البدء، الإنهاء، وضع التعديل |
| `app/components/impersonation/Bar.vue` · `StartButton.vue` | الشريط وزرّ «ادخل بحسابه» بنافذة التأكيد |
| `app/layouts/dashboard.vue` · `app/composables/useAuth.ts` · `app/middleware/auth.global.ts` · `app/utils/accountGate.ts` (+test) · `app/pages/change-password.vue` · `app/components/NotificationsBell.vue` · `app/composables/useInbox.ts` · `app/pages/users/index.vue` · `app/pages/profile/[id].vue` · مكوّنات الرفع | الدمج في الواجهة |
| `docs/*` + `CLAUDE.md` | التوثيق والمصفوفة |

---

### Task 1: لبُّ القاعدة — الجلسات والحارسان والسجلّ والإشعاران والإبطال

**Files:**
- Create: `supabase/migrations/<applied-version>_impersonation_core.sql`
- Modify: `app/types/database.types.ts` (مولَّد)

**Interfaces:**
- Produces: `public.impersonation_sessions` (لـ`service_role`: select/insert/update — **لا delete لأحد**)؛ `public.impersonation_writes` (قراءةٌ للمدير الإداري؛ إدراجٌ لـ`service_role` والمشغّل)؛ `private.is_impersonating() → boolean`، `private.session_is_read_only() → boolean`، `private.assert_session_writable() → boolean` (ترمي `42501`)؛ `private.log_impersonation_write()` (دالّة مشغّل — تُعلَّق في Task 2)؛ `public.end_impersonation_sessions(p_session_ids uuid[]) → integer` لـ`service_role` وحده.

- [ ] **Step 1: اكتب الهجرة في `supabase/migrations/impersonation_core.sql`**

```sql
-- ============================================================
-- الدخول بالنيابة (الجزء ٥) — اللبّ. منقولٌ من الصحابة بتعديلات (الخطة 2026-10-20-impersonation.md).
-- الوسمُ على الجلسة (session_id في JWT) لا على الحساب: الموظفُ يعمل في جلسته بلا أثر.
-- الحارسُ يسأل «هل هذه الجلسةُ نيابة؟» لا «هل ما زالت مفتوحة؟» — فالصفُّ لا يُحذف أبداً
-- والجلسةُ المنسيّة تبقى قراءةً فقط إلى أن تُبطَل: يفشل مغلقاً.
-- ============================================================

create table public.impersonation_sessions (
  session_id        uuid primary key,
  -- المعرّفان يقبلان الفراغ ومعهما الاسمان نصّاً: السجلُّ يبقى بعد حذف الحساب (لا cascade).
  actor_profile_id  uuid references auth.users (id) on delete set null,
  target_profile_id uuid references auth.users (id) on delete set null,
  actor_name        text not null check (btrim(actor_name) <> ''),
  target_name       text not null check (btrim(target_name) <> ''),
  actor_role        public.user_role not null check (actor_role in ('admin_manager', 'technical_manager')),
  started_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  ended_at          timestamptz,
  ended_reason      text check (ended_reason in ('manual', 'signed_out', 'superseded', 'expired', 'actor_inactive')),
  write_until       timestamptz,
  return_to         text check (return_to is null or return_to ~ '^/[A-Za-z0-9/_?=&-]*$'),
  constraint impersonation_window check (expires_at > started_at and expires_at <= started_at + interval '30 minutes'),
  constraint impersonation_write_within check (write_until is null or write_until <= expires_at),
  constraint impersonation_end_stamp check ((ended_at is null) = (ended_reason is null)),
  -- `<>` لا `is distinct from`: بعد حذف الحسابين (null, null) يبقى القيدُ صادقاً.
  constraint impersonation_not_self check (actor_profile_id <> target_profile_id)
);
create index impersonation_sessions_actor on public.impersonation_sessions (actor_profile_id, started_at desc);
create index impersonation_sessions_target on public.impersonation_sessions (target_profile_id);
create index impersonation_sessions_open on public.impersonation_sessions (expires_at) where ended_at is null;

-- RLS بلا سياسةٍ واحدة — مقصود: لا يبلغه العميلُ قراءةً ولا كتابة؛ يكتبه الخادمُ وتقرؤه الدوالّ definer.
alter table public.impersonation_sessions enable row level security;
revoke all on public.impersonation_sessions from public, anon, authenticated;
-- ولا delete لأحد: حذفُ الصفّ يمحو السجلّ **ويقلب جلسةً حيّةً جلسةً كاملةَ الكتابة**.
grant select, insert, update on public.impersonation_sessions to service_role;

-- سجلُّ الكتابة في وضع التعديل — الصفُّ كاملاً قبلُ وبعدُ، وفتحُ النافذة وإغلاقُها.
create table public.impersonation_writes (
  id                bigint generated always as identity primary key,
  session_id        uuid not null,
  actor_profile_id  uuid,
  target_profile_id uuid,
  occurred_at       timestamptz not null default now(),
  op                text not null check (op in ('INSERT', 'UPDATE', 'DELETE', 'write_mode_on', 'write_mode_off')),
  table_name        text,
  old_row           jsonb,
  new_row           jsonb,
  route             text
);
create index impersonation_writes_session on public.impersonation_writes (session_id, occurred_at);
alter table public.impersonation_writes enable row level security;
revoke all on public.impersonation_writes from public, anon, authenticated;
grant select on public.impersonation_writes to authenticated;
-- لا update/delete لأحد: سجلُّ تدقيقٍ يُعدَّل ليس سجلاً.
grant select, insert on public.impersonation_writes to service_role;
grant usage, select on sequence public.impersonation_writes_id_seq to service_role;
create policy impersonation_writes_select on public.impersonation_writes for select to authenticated
  using (public.is_admin_manager());

-- ═══ الحارسان ═══
-- nullif يحرس الفراغ: رمزٌ بلا session_id (service_role، postgres) ← «لا».
create or replace function private.is_impersonating()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.impersonation_sessions s
    where s.session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
  );
$$;

-- لا تنظر في ended_at ولا expires_at: الانتهاءُ لا يفتح الكتابة أبداً.
create or replace function private.session_is_read_only()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.impersonation_sessions s
    where s.session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and (s.write_until is null or s.write_until <= now())
  );
$$;

-- ما تناديه السياساتُ التقييديّة: ترمي برسالةٍ تقول إنّه منعٌ مقصودٌ لا عطب (النصُّ = IMPERSONATION_READ_ONLY_MESSAGE).
create or replace function private.assert_session_writable()
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.session_is_read_only() then
    raise exception 'أنت تتصفّح بالنيابة — قراءةٌ فقط، فلا يُحفظ شيءٌ باسم غيرك. فعّل وضعَ التعديل من الشريط إن لزم.'
      using errcode = '42501';
  end if;
  return true;
end;
$$;

revoke all on function private.is_impersonating() from public, anon, authenticated;
revoke all on function private.session_is_read_only() from public, anon, authenticated;
revoke all on function private.assert_session_writable() from public, anon, authenticated;
-- في السياسات وفي WHEN — فلكلّ دورٍ يكتب: authenticated (PostgREST) وservice_role (الخادم).
grant execute on function private.is_impersonating() to authenticated, service_role;
grant execute on function private.session_is_read_only() to authenticated, service_role;
grant execute on function private.assert_session_writable() to authenticated, service_role;

-- ═══ مشغّلُ السجلّ (يُعلَّق على الجداول في Task 2) ═══
create or replace function private.log_impersonation_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  s record;
begin
  select session_id, actor_profile_id, target_profile_id into s
  from public.impersonation_sessions
  where session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid;

  insert into public.impersonation_writes (session_id, actor_profile_id, target_profile_id, op, table_name, old_row, new_row)
  values (s.session_id, s.actor_profile_id, s.target_profile_id, tg_op, tg_table_schema || '.' || tg_table_name,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return null;
end;
$$;
revoke all on function private.log_impersonation_write() from public, anon, authenticated;

-- ═══ مُنتِجا الإشعار (عقد العمود الفقريّ ب، ج) ═══
-- يكتب الصفَّ service_role فـauth.uid() فارغ ← شرطُ «لا يُشعَر أحدٌ بفعله» في private.notify لا يُسقطه.
-- ولا WHEN بدالّة على المشغّل (يُقيَّم بصلاحية service_role) — المنطقُ في البدن.
create or replace function private.notify_impersonation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_gender text;
  v_label text;
begin
  select p.gender::text into v_gender from public.profiles p where p.id = new.actor_profile_id;
  v_label := case
    when new.actor_role = 'admin_manager' then 'المدير الإداري'
    when v_gender = 'female' then 'المديرة الفنية'
    else 'المدير الفني' end;

  if tg_op = 'INSERT' then
    perform private.notify(
      new.target_profile_id, 'impersonation_started',
      'اطّلع ' || v_label || ' على حسابك',
      'فتح ' || new.actor_name || ' شاشتَك قراءةً فقط في '
        || to_char(new.started_at at time zone 'Asia/Gaza', 'DD-MM-YYYY HH24:MI')
        || ' (بتوقيت غزة) لنصف ساعةٍ على الأكثر. لم يُغيَّر شيء.',
      null, 'impersonation_sessions', new.session_id);
  elsif new.write_until is not null and new.write_until > now()
        and (old.write_until is null or old.write_until <= now()) then
    perform private.notify(
      new.target_profile_id, 'impersonation_write',
      'فتح ' || v_label || ' التعديلَ في حسابك',
      'يستطيع ' || new.actor_name || ' التعديلَ باسمك حتى '
        || to_char(new.write_until at time zone 'Asia/Gaza', 'HH24:MI')
        || ' (بتوقيت غزة)، وكلُّ تعديلٍ فيها مسجَّلٌ بصورته قبلُ وبعدُ.',
      null, 'impersonation_sessions', new.session_id);
  end if;
  return null;
end;
$$;
revoke all on function private.notify_impersonation() from public, anon, authenticated;
create trigger impersonation_notify_started after insert on public.impersonation_sessions
  for each row execute function private.notify_impersonation();
create trigger impersonation_notify_write after update of write_until on public.impersonation_sessions
  for each row execute function private.notify_impersonation();

-- ═══ إبطالُ جلسات النيابة بمعرّفها — لا revoke_sessions (تحذف كلَّ جلسات المستخدم) ═══
create or replace function private.end_impersonation_sessions(p_session_ids uuid[])
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_removed integer;
begin
  if p_session_ids is null or cardinality(p_session_ids) = 0 then
    return 0;
  end if;
  -- لا تُبطَل إلّا جلسةٌ مسجَّلةٌ نيابةً: وإلّا صارت بابَ إخراجٍ لأيّ مستخدم.
  delete from auth.sessions s
   where s.id = any (p_session_ids)
     and exists (select 1 from public.impersonation_sessions i where i.session_id = s.id);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
revoke all on function private.end_impersonation_sessions(uuid[]) from public, anon, authenticated;
grant execute on function private.end_impersonation_sessions(uuid[]) to service_role;

-- وجهٌ في public لأنّ PostgREST لا يبلغ private (§0) — لـservice_role وحده، والحارسُ في المفوَّض إليه.
create or replace function public.end_impersonation_sessions(p_session_ids uuid[])
returns integer language sql security definer set search_path = ''
as $$ select private.end_impersonation_sessions(p_session_ids); $$;
revoke all on function public.end_impersonation_sessions(uuid[]) from public, anon, authenticated;
grant execute on function public.end_impersonation_sessions(uuid[]) to service_role;

-- ═══ بياناتُ الدخول خارج RLS: GoTrue يكتب auth.users بدوره هو ═══
-- جلسةُ النيابة تملك auth.updateUser({ password | email }) — والمدير الفني لا يملك إعادة التعيين أصلاً.
-- فما دامت للهدف جلسةُ نيابةٍ حيّة في auth.sessions يُرفض تغييرُ بيانات دخوله (من أيّ جلسة — يفشل مغلقاً).
-- reset-password يرفع must_change_password أوّلاً ← profiles_revoke_sessions يُبطل جلسةَ النيابة ← فيمرّ.
-- WHEN بمقارنة أعمدةٍ فقط (لا دالّة) — فلا منحَ يلزم supabase_auth_admin.
create or replace function private.guard_impersonated_credentials()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.impersonation_sessions i
    join auth.sessions s on s.id = i.session_id
    where i.target_profile_id = new.id
  ) then
    raise exception 'لا تُغيَّر بياناتُ الدخول وللحساب جلسةُ نيابةٍ قائمة.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_impersonated_credentials() from public, anon, authenticated;
create trigger impersonation_credentials_guard
  before update of encrypted_password, email, email_change, phone on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password
        or old.email is distinct from new.email
        or old.email_change is distinct from new.email_change
        or old.phone is distinct from new.phone)
  execute function private.guard_impersonated_credentials();

-- ═══ فحصٌ ذاتيّ ═══
do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'impersonation_sessions') <> 0 then
    raise exception 'impersonation_sessions يجب أن يكون بلا سياسة';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.impersonation_sessions'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.impersonation_writes'::regclass) then
    raise exception 'RLS مطفأة على جدول نيابة';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'impersonation_sessions'
               and grantee in ('anon', 'authenticated')) then
    raise exception 'impersonation_sessions يبلغه العميل';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name in ('impersonation_sessions', 'impersonation_writes')
               and privilege_type = 'DELETE' and grantee in ('anon', 'authenticated', 'service_role')) then
    raise exception 'حذفٌ ممنوحٌ على جدول نيابة';
  end if;
  if not has_function_privilege('authenticated', 'private.assert_session_writable()', 'execute')
     or not has_function_privilege('service_role', 'private.assert_session_writable()', 'execute')
     or not has_function_privilege('service_role', 'private.is_impersonating()', 'execute')
     or not has_function_privilege('authenticated', 'private.is_impersonating()', 'execute') then
    raise exception 'منحُ الحارسين ناقص — ستسقط الكتابة';
  end if;
  if has_function_privilege('authenticated', 'public.end_impersonation_sessions(uuid[])', 'execute')
     or has_function_privilege('anon', 'public.end_impersonation_sessions(uuid[])', 'execute')
     or not has_function_privilege('service_role', 'public.end_impersonation_sessions(uuid[])', 'execute') then
    raise exception 'end_impersonation_sessions: المنحُ خاطئ';
  end if;
  if (select private.is_impersonating()) is not false or (select private.session_is_read_only()) is not false then
    raise exception 'الحارسان لا يُرجعان «لا» بلا جلسة';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'impersonation_credentials_guard'
                 and tgrelid = 'auth.users'::regclass) then
    raise exception 'حارسُ بيانات الدخول لم يُنشأ';
  end if;
end $$;
```

> إن رفض Supabase إنشاءَ المشغّل على `auth.users` (`42501`): **توقّف وأبلغ المتحكّم** — لا تُكمل بدونه بصمت؛ البديلُ (إخفاءٌ في الواجهة وحدَه) قرارٌ يُعرض على المستخدم.

- [ ] **Step 2: تحقّقٌ سلوكيّ قبل التطبيق** — عبر `execute_sql`: كتلة `do` تُنفّذ نصّ الهجرة (DDL بـ`execute`) ثم الحالات، وتنتهي بـ`raise exception 'rollback-ok: …'`. الهويّات: المعلم التجريبيّ (`full_name` يبدأ «تجريبي — معلم»)، والمدير الإداري `1001` (**قراءةُ معرّفه فقط**). صفوفُ `auth.sessions` تُدرَج داخل الكتلة (`id, user_id, created_at, updated_at, aal = 'aal1'`) وتُلغى معها:
  1. إدراجُ `impersonation_sessions` (S1 للمعلم، الفاعل 1001، `expires_at = now()+30m`) بـ`set local role service_role` ← إشعارٌ `impersonation_started` واحد للمعلم، عنوانُه «اطّلع المدير الإداري على حسابك» وفيه التاريخ `DD-MM-YYYY`.
  2. `update … set write_until = now() + 10 min` ← إشعار `impersonation_write`؛ تحديثٌ ثانٍ والنافذةُ مفتوحة ← **لا** إشعارَ ثانٍ.
  3. `request.jwt.claims` بـ`sub` المعلم و`session_id` S1، `set local role authenticated`: `private.is_impersonating()` = true، و`session_is_read_only()` = false (النافذة مفتوحة)؛ ثم `write_until = now()` ← `session_is_read_only()` = true و`assert_session_writable()` ترمي `42501` بالنصّ.
  4. جلسةٌ عاديّة S2 للمعلم بلا صفّ ← الحارسان «لا».
  5. `public.end_impersonation_sessions(array[S1, S2])` بـ`service_role` ← يردّ 1، وS2 باقية.
  6. مع S1 حيّة: `update auth.users set encrypted_password = encrypted_password where …` لا يُطلق المشغّل (لا تغيير)؛ `set encrypted_password = crypt('x', gen_salt('bf'))` للمعلم ← `42501`؛ بعد حذف S1 ← يمرّ (داخل الكتلة الملغاة).
  7. `anon` لا يقرأ `impersonation_sessions`، و`authenticated` لا يقرأ `impersonation_writes` إلا المدير الإداري.
  اكتب الناتجَ في التقرير.

- [ ] **Step 3: طبّق** بـ`apply_migration` (الاسم `impersonation_core`)، اقرأ النسخة من `list_migrations`، وأعد التسمية `supabase/migrations/<version>_impersonation_core.sql`.
- [ ] **Step 4: الأنواع** (إضافاتٌ فقط: الجدولان، `end_impersonation_sessions`).
- [ ] **Step 5:** `pnpm lint && pnpm test`؛ vue-tsc بلا جديد.
- [ ] **Step 6: Commit** `feat(db): لبُّ الدخول بالنيابة — الجلساتُ والحارسان والسجلّ والإشعاران`

---

### Task 2: القاعدة — حراسةُ كلّ كتابة (السياساتُ التقييديّة والمشغّلات وحرسُ الأبدان)

**Files:**
- Create: `supabase/migrations/<applied-version>_impersonation_read_only_sweep.sql`, `server/utils/impersonationDbGuards.test.ts`

**Interfaces:**
- Consumes (Task 1): `private.assert_session_writable()`، `private.is_impersonating()`، `private.log_impersonation_write()`.
- Produces: `private.guard_table_for_impersonation(p_table regclass, p_audit boolean default true) → void` (للهجرات وحدها — بلا منحٍ لأحد) — **كلُّ جدولٍ يُنشأ بعد اليوم تناديه هجرتُه** (يحرسه الاختبار)؛ ثلاثُ سياساتٍ تقييديّة باسمٍ ثابت `impersonation_ro_insert|update|delete` على كلّ جدول؛ مشغّل `log_impersonation_write` على كلّ جدولٍ مُدقَّق.

- [ ] **Step 1: الهجرة**

```sql
-- ============================================================
-- النيابةُ قراءةٌ فقط — في القاعدة لا في الواجهة (الجزء ٥).
-- سياساتٌ تقييديّة تُضاف ولا تُمسّ السياساتُ القائمة: سياساتُ ALL الأربع التي هي طريقُ قراءة
-- مشرف المشروع تبقى كما هي (إلحاقُ الحارس بـUSING فيها يُعميه)، وصيغُ visible_halaqa_ids
-- وفروعُ الطالب المنقول لا تُلمس حرفاً. وكلُّ سياسة كتابةٍ تُضاف غداً على جدولٍ هنا محروسةٌ تلقائياً.
-- خطُّ الأساس 2026-10-20: 55 سياسةَ كتابة (47 public على 25 جدولاً + 8 storage.objects).
-- ============================================================

-- لقطةُ كلّ السياسات قبل المسّ — تُقارَن في الذيل حرفاً (الاسم، الأمر، النوع، الأدوار، النصّان).
create temporary table _policies_before on commit drop as
select schemaname, tablename, policyname, cmd, permissive, roles::text[] as roles, qual, with_check
from pg_policies where schemaname in ('public', 'storage');

create or replace function private.guard_table_for_impersonation(p_table regclass, p_audit boolean default true)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_schema text;
  v_name text;
  v_guard constant text := '(select private.assert_session_writable())';
begin
  select n.nspname, c.relname into v_schema, v_name
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.oid = p_table;

  execute format('drop policy if exists impersonation_ro_insert on %I.%I', v_schema, v_name);
  execute format('drop policy if exists impersonation_ro_update on %I.%I', v_schema, v_name);
  execute format('drop policy if exists impersonation_ro_delete on %I.%I', v_schema, v_name);
  execute format('create policy impersonation_ro_insert on %I.%I as restrictive for insert to authenticated with check (%s)', v_schema, v_name, v_guard);
  execute format('create policy impersonation_ro_update on %I.%I as restrictive for update to authenticated using (%s) with check (%s)', v_schema, v_name, v_guard, v_guard);
  execute format('create policy impersonation_ro_delete on %I.%I as restrictive for delete to authenticated using (%s)', v_schema, v_name, v_guard);

  if p_audit then
    execute format('drop trigger if exists log_impersonation_write on %I.%I', v_schema, v_name);
    -- WHEN بدالّة: مُنحت لـauthenticated وservice_role في Task 1 (يُقيَّم بصلاحية المنفِّذ).
    execute format('create trigger log_impersonation_write after insert or update or delete on %I.%I '
                   'for each row when (private.is_impersonating()) execute function private.log_impersonation_write()',
                   v_schema, v_name);
  end if;
end;
$$;
revoke all on function private.guard_table_for_impersonation(regclass, boolean) from public, anon, authenticated, service_role;

-- كلُّ جداول public (لا ذاتُ السياسات وحدها — كي تُحرس سياسةٌ تُضاف غداً على جدولٍ بلا سياسةٍ اليوم)،
-- إلا جدولَي النيابة (يكتبهما الخادم والمشغّل؛ والسجلُّ لا يُدقِّق نفسَه) و notifications (تكتبه دوالّ definer).
do $$
declare
  t record;
begin
  for t in
    select c.oid::regclass as rel
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and c.relname not in ('impersonation_sessions', 'impersonation_writes', 'notifications')
  loop
    perform private.guard_table_for_impersonation(t.rel, true);
  end loop;
  -- المستودعات: حارسٌ بلا سجلّ (لا مشغّلات منّا على storage.objects).
  perform private.guard_table_for_impersonation('storage.objects'::regclass, false);
end $$;
```

ثم **حرسُ البدن** في الدوالّ الثلاث — **اقرأ تعريفها الحاليّ من الإنتاج** (`select pg_get_functiondef('public.<name>(<args>)'::regprocedure)`) وأعد إنشاءها حرفاً مع سطرٍ واحدٍ بعد `begin`:
- `public.mark_notifications_read(uuid[])`: `if private.is_impersonating() then return 0; end if;` — **في كلّ نيابة، ولو في وضع التعديل**: قراءةُ المدير لإشعارات الموظف ليست قراءةَ الموظف، وتعليمُها يُخفيها عنه (عقد العمود الفقريّ ب).
- `public.set_transport_paid(uuid[], boolean)`: `perform private.assert_session_writable();`
- `public.update_my_contact(text, text, text, text)`: `perform private.assert_session_writable();` (و`search_path` الحاليّ `public` يبقى كما هو في الإنتاج — لا تغيّره في هذه الهجرة).

ثم الفحص الذاتيّ:

```sql
do $$
declare
  v_missing text;
begin
  -- ① لا سياسةَ قائمةٌ تغيّرت (الاسم/الأمر/النوع/الأدوار/النصّان) ولا اختفت.
  if exists (
    select * from _policies_before
    except
    select schemaname, tablename, policyname, cmd, permissive, roles::text[], qual, with_check
    from pg_policies where schemaname in ('public', 'storage')
  ) then
    raise exception 'سياسةٌ قائمةٌ تغيّرت أو اختفت — الهجرةُ تُضيف ولا تمسّ';
  end if;

  -- ② كلُّ جدولٍ فيه سياسةُ كتابةٍ مسموحة محروسٌ بالثلاث (ومنها storage.objects).
  select string_agg(distinct p.schemaname || '.' || p.tablename, ', ') into v_missing
  from pg_policies p
  where p.schemaname in ('public', 'storage') and p.permissive = 'PERMISSIVE'
    and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (select count(*) from pg_policies g
         where g.schemaname = p.schemaname and g.tablename = p.tablename
           and g.permissive = 'RESTRICTIVE' and g.policyname like 'impersonation_ro_%'
           and coalesce(g.qual, '') || coalesce(g.with_check, '') like '%assert_session_writable%') <> 3;
  if v_missing is not null then
    raise exception 'جداولُ كتابةٍ بلا حارس النيابة: %', v_missing;
  end if;

  -- ③ العدد: 3 × (جداول public المحروسة + storage.objects).
  if (select count(*) from pg_policies where policyname like 'impersonation_ro_%')
     <> 3 * ((select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
              and relname not in ('impersonation_sessions', 'impersonation_writes', 'notifications')) + 1) then
    raise exception 'عددُ السياسات التقييديّة لا يطابق';
  end if;

  -- ④ كلُّ جدولٍ مُدقَّق عليه المشغّل.
  if exists (
    select 1 from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and c.relname not in ('impersonation_sessions', 'impersonation_writes', 'notifications')
      and not exists (select 1 from pg_trigger tr where tr.tgrelid = c.oid and tr.tgname = 'log_impersonation_write')
  ) then
    raise exception 'جدولٌ محروسٌ بلا مشغّل السجلّ';
  end if;

  -- ⑤ كلُّ دالّة definer في public يستدعيها authenticated وتكتب ← فيها الحارس.
  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')
    and pg_get_functiondef(p.oid) ~* '\m(insert\s+into|update\s+[a-z_.]+\s+set|delete\s+from)'
    and pg_get_functiondef(p.oid) !~ '(assert_session_writable|session_is_read_only|is_impersonating)';
  if v_missing is not null then
    raise exception 'دوالّ definer كاتبةٌ بلا حارس: %', v_missing;
  end if;

  -- ⑥ دالّةُ السجلّ ليست لـanon/authenticated (قاعدة المشغّلات).
  if has_function_privilege('authenticated', 'private.log_impersonation_write()', 'execute') then
    raise exception 'log_impersonation_write ممنوحةٌ للعميل';
  end if;
end $$;

-- ⑦ الكتابةُ بـservice_role ما زالت تمرّ (درس الصحابة 2026-09-22: شرطُ WHEN أسقط كلَّ كتابة الخادم).
do $$
begin
  begin
    set local role service_role;
    update public.app_settings set updated_at = updated_at where true;
    raise exception 'PROBE' using errcode = 'P9002';
  exception
    when sqlstate 'P9002' then reset role;
    when others then reset role; raise exception 'الكتابةُ بـservice_role تسقط: % — %', sqlstate, sqlerrm;
  end;
end $$;
```

- [ ] **Step 2: تحقّقٌ سلوكيّ قبل التطبيق (كتلةٌ ملغاة، بأدوارٍ حقيقية وجلساتٍ مُدرَجة داخلها)** — لكلّ حالةٍ `set local role authenticated` و`request.jwt.claims` بـ`sub` و`role` و`session_id`:
  1. **نيابةُ قراءةٍ على المعلم التجريبيّ** (S1، `write_until` فارغ): إدراجُ `attendance_days` لحلقته اليوم ← `42501` بالنصّ العربيّ؛ تحديثُ `students` في حلقته ← `42501`؛ حذفُ `quran_records` من مسوّدته ← `42501`؛ إدراجٌ في `storage.objects` (`bucket_id = 'profile-photos'`، `name = '<id>/photo.webp'`) ← `42501`؛ `select public.mark_notifications_read()` ← 0 ولا يتغيّر `read_at`؛ **القراءة سليمة**: عددُ طلاب حلقته = عددُهم بجلسةٍ عاديّة.
  2. **نيابةُ قراءةٍ على مشرف المشروع** (S3): `count(*)` من `financial_transactions` و`monthly_salaries` و`meeting_minutes` و`profile_financials` = عددُها بجلسته العاديّة (القرار ١).
  3. **وضعُ التعديل** (`write_until = now() + 10 min` بـ`service_role`): إدراجُ يومِ حضورٍ للمعلم ← ينجح، ويُكتب صفٌّ في `impersonation_writes` (`op = 'INSERT'`، `table_name = 'public.attendance_days'`، `new_row` مملوء، `actor_profile_id` = 1001)؛ و`mark_notifications_read()` ← 0 (مقصود).
  4. **الجلسةُ العاديّة** (S2 للمعلم بلا صفّ نيابة): الإدراج نفسُه ← ينجح، **ولا** صفَّ في `impersonation_writes`.
  5. **service_role** (بلا `session_id`): `update app_settings` ← ينجح بلا صفّ سجلّ.
  6. **النيابةُ المنتهية** (`expires_at` في الماضي، `write_until` فارغ): الكتابة ← `42501` (لا يفتحها مرورُ الوقت).
  7. `set_transport_paid` في نيابة قراءةٍ على مشرفٍ ميدانيّ ← `42501`؛ `update_my_contact` بجلسة نيابةٍ (أيّاً كان الهدف) ← `42501` قبل فحص الدور.
  إن رفض حارسٌ آخرُ قائمٌ الحالةَ (قفلُ الشهر، مستقبل…) لسببٍ غيرِ النيابة فاختر يوماً/صفّاً آخر — المقصودُ أن يكون الرفضُ **من حارس النيابة** (النصُّ يُطابَق).

- [ ] **Step 3: طبّق** بـ`apply_migration` (الاسم `impersonation_read_only_sweep`) وأعد تسمية الملف بالنسخة.
- [ ] **Step 4: حارسُ الهجرات القادمة — `server/utils/impersonationDbGuards.test.ts`**:

```ts
/**
 * حرسُ النيابة في الهجرات القادمة: كلُّ جدولٍ جديدٍ في public يُحرس، وكلُّ دالّة definer كاتبةٍ تفحص الجلسة.
 * الهجرةُ نفسُها تفحص الإنتاج لحظةَ تطبيقها؛ وهذا يمسك ما يُكتب بعدها.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const DIR = 'supabase/migrations'
const SWEEP = readdirSync(DIR).find(f => f.endsWith('_impersonation_read_only_sweep.sql'))!
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
const after = readdirSync(DIR).filter(f => f.endsWith('.sql') && f > SWEEP).map(f => [f, strip(readFileSync(`${DIR}/${f}`, 'utf8'))] as const)

describe('حرسُ النيابة في الهجرات اللاحقة', () => {
  it('هجرةُ الحراسة موجودة', () => expect(SWEEP).toBeTruthy())

  it('كلُّ create table public.* تنادي guard_table_for_impersonation', () => {
    for (const [file, sql] of after) {
      for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)) {
        expect(sql, `${file}: ${m[1]} بلا حارس النيابة`).toMatch(new RegExp(`guard_table_for_impersonation\\(\\s*'public\\.${m[1]}'`))
      }
    }
  })

  it('كلُّ دالّة public security definer كاتبةٍ تفحص الجلسة', () => {
    for (const [file, sql] of after) {
      for (const fn of sql.split(/create or replace function /i).slice(1)) {
        const head = fn.slice(0, fn.indexOf('$$'))
        if (!/^public\./.test(fn) || !/security definer/i.test(head) || /returns trigger/i.test(head)) continue
        const body = fn.split('$$')[1] ?? ''
        if (!/\b(insert\s+into|update\s+[\w.]+\s+set|delete\s+from)\b/i.test(body)) continue
        expect(body, `${file}: ${fn.slice(0, 60)}`).toMatch(/assert_session_writable|session_is_read_only|is_impersonating/)
      }
    }
  })
})
```

- [ ] **Step 5:** `pnpm lint && pnpm test`؛ vue-tsc بلا جديد؛ **افتح على 3030 بجلسةٍ عاديّة** شاشتين تكتبان (الحضور ورحلةُ مواصلات تجريبية إن وُجدت جلسة) وتأكّد أنّ الكتابة العاديّة تعمل — لا كتابةَ باقية في القاعدة (احذف ما أُنشئ بإذن المستخدم).
- [ ] **Step 6: Commit** `feat(db): النيابةُ قراءةٌ فقط في القاعدة — سياساتٌ تقييديّة وسجلُّ الكتابة وحرسُ الأبدان`

---

### Task 2ب: كنسُ الجلسات المنتهية بـ`pg_cron` — **بإذن المستخدم (قرار ٢)**

**العلّة:** جلسةُ النيابة تُغلق بزرّ «إنهاء» أو بالعدّ في الشريط أو بكنس الفاعل عند بدءٍ تالٍ (24 ساعة). **لسانٌ أُغلق بلا إنهاء** يترك جلسةً حيّة في `auth.sessions`: قراءةً فقط (لا تنكسر الحراسة)، لكنّ RLS القائمة على `current_user_role()` تبقى تعطيها دوراً، **وحارسُ بيانات الدخول (Task 1) يمنع الموظفَ نفسَه من تغيير كلمته** ما دامت حيّة.

- [ ] هجرة `<v>_impersonation_expiry_sweep.sql`: `create extension if not exists pg_cron;` (في المخطّط الذي توصي به Supabase)، و`private.sweep_expired_impersonations() returns integer` (definer، `search_path=''`): تختم `ended_at = now(), ended_reason = 'expired'` حيث `ended_at is null and expires_at <= now()`، ثم `private.end_impersonation_sessions(array(select session_id from public.impersonation_sessions where expires_at <= now()))`؛ و`cron.schedule('impersonation-expiry-sweep', '*/5 * * * *', $$select private.sweep_expired_impersonations()$$)`؛ وفحصٌ ذاتيّ للمهمّة. تحقّقٌ ملغى: جلسةٌ منتهية مُدرَجة تُكنس وتُختم، وحيّةٌ لا تُمسّ.
- [ ] Commit `feat(db): كنسُ جلسات النيابة المنتهية كلَّ خمس دقائق`
- **إن رفض المستخدم:** لا يُبنى، ويُوثَّق الحدُّ في `DATABASE.md` (الجلسةُ المتروكة تبقى حتى كنسِ الفاعل التالي).

---

### Task 3: الخادم — المستدعي والنطاق والمسارات الأربعة والحارس في كلّ مسارٍ كاتب

**Files:**
- Create: `app/constants/impersonation.ts` (+`impersonation.test.ts`)، `server/utils/caller.ts` (+`caller.test.ts`)، `server/utils/impersonationGuard.ts`، `server/utils/impersonationScope.ts` (+`impersonationScope.test.ts`)، `server/utils/impersonationSession.ts`، `server/api/impersonate.post.ts`، `server/api/impersonate/end.post.ts`، `server/api/impersonate/write-mode.post.ts`، `server/api/me/impersonation.get.ts`، `server/utils/impersonationGuardCoverage.test.ts`، `server/utils/impersonationRoutes.test.ts`
- Modify: `server/utils/supabaseAdmin.ts`، والمسارات الخمسة الكاتبة.

**Interfaces:**
- Consumes: Task 1 (الجدولان، `end_impersonation_sessions`)، `Role` و`STAFF_ROLES` من `~/constants/roles`.
- Produces:

```ts
// app/constants/impersonation.ts — مصدرٌ واحد للخادم والواجهة
export const IMPERSONATION_WINDOW_MINUTES = 30
export const WRITE_WINDOW_MINUTES = 10
export const STALE_SWEEP_HOURS = 24
export const IMPERSONATOR_ROLES = ['admin_manager', 'technical_manager'] as const
export type ImpersonatorRole = typeof IMPERSONATOR_ROLES[number]
/** قائمةٌ بيضاء لكلّ فاعل — لا «كلُّ دورٍ إلا…» (تنكسر صامتةً مع كلّ دورٍ جديد). */
export const IMPERSONATION_TARGETS: Record<ImpersonatorRole, readonly Role[]> = {
  admin_manager: ['project_supervisor', 'technical_manager', 'women_admin', 'field_supervisor', 'examiner', 'teacher'],
  technical_manager: ['project_supervisor', 'women_admin', 'field_supervisor', 'examiner', 'teacher']
}
/** النصُّ نفسُه في private.assert_session_writable (يحرسه اختبار). */
export const IMPERSONATION_READ_ONLY_MESSAGE = 'أنت تتصفّح بالنيابة — قراءةٌ فقط، فلا يُحفظ شيءٌ باسم غيرك. فعّل وضعَ التعديل من الشريط إن لزم.'
export function mayImpersonateRole(actorRole: Role | null | undefined, targetRole: Role): boolean

// server/utils/caller.ts
export interface ImpersonationRow {
  session_id: string, actor_profile_id: string | null, target_profile_id: string | null,
  actor_name: string, target_name: string, actor_role: Role,
  started_at: string, expires_at: string, ended_at: string | null, write_until: string | null, return_to: string | null
}
export interface Caller { id: string, role: Role, sessionId: string | null, impersonation: ImpersonationRow | null, isImpersonating: boolean, canWrite: boolean }
export function sessionCanWrite(row: Pick<ImpersonationRow, 'write_until'> | null, now?: number): boolean
export async function readSessionClaims(event: H3Event): Promise<{ sub: string, sessionId: string | null } | null>
export async function requireCaller(event: H3Event): Promise<{ caller: Caller, admin: SupabaseClient<Database> }>

// server/utils/impersonationGuard.ts
export function requireWritableSession(caller: Pick<Caller, 'canWrite'>): void   // 403 بـIMPERSONATION_READ_ONLY_MESSAGE

// server/utils/impersonationScope.ts — نقيٌّ كلُّه (بلا h3) كنمط accountInput: يُرجع قراراً لا يرمي
export type Decision = { ok: true } | { ok: false, statusCode: 400 | 403, message: string }
export function assertMayImpersonate(
  actor: { id: string, role: Role, isImpersonating: boolean },
  target: { id: string, role: Role, status: string }
): Decision
export function impersonationReturnTo(from: unknown, targetId: string): string
export function parseImpersonateInput(body: unknown): Parsed<{ profileId: string, from: string | null }>
export function parseWriteModeInput(body: unknown): Parsed<{ on: boolean }>
export function parseEndInput(body: unknown): Parsed<{ resume: boolean }>
export function sessionIdFromAccessToken(token: string): string | null

// server/utils/impersonationSession.ts
export async function openSessionFor(admin: SupabaseClient<Database>, userId: string): Promise<{ accessToken: string, refreshToken: string, sessionId: string }>
```

- [ ] **Step 1: الاختبارات الفاشلة**

`server/utils/impersonationScope.test.ts` — جدولُ السلوك كلُّه:

```ts
import { describe, expect, it } from 'vitest'
import { assertMayImpersonate, impersonationReturnTo, parseImpersonateInput, sessionIdFromAccessToken } from './impersonationScope'
import type { Role } from '~/constants/roles'

const actor = (role: Role, over: Partial<{ id: string, isImpersonating: boolean }> = {}) => ({ id: 'a', role, isImpersonating: false, ...over })
const target = (role: Role, over: Partial<{ id: string, status: string }> = {}) => ({ id: 't', role, status: 'active', ...over })
const ok = (d: ReturnType<typeof assertMayImpersonate>) => d.ok

describe('assertMayImpersonate', () => {
  it('المدير الإداري عن كلّ موظفٍ نشط ومنهم المدير الفني', () => {
    for (const r of ['project_supervisor', 'technical_manager', 'women_admin', 'field_supervisor', 'examiner', 'teacher'] as Role[]) {
      expect(ok(assertMayImpersonate(actor('admin_manager'), target(r))), r).toBe(true)
    }
  })
  it('المدير الفني عن كلّ موظفٍ نشط إلا المدير الإداري', () => {
    expect(ok(assertMayImpersonate(actor('technical_manager'), target('teacher')))).toBe(true)
    expect(ok(assertMayImpersonate(actor('technical_manager'), target('project_supervisor')))).toBe(true)
    expect(assertMayImpersonate(actor('technical_manager'), target('admin_manager'))).toMatchObject({ ok: false, statusCode: 403 })
  })
  it('لا أحد عن المدير الإداري ولا عن طالب', () => {
    expect(assertMayImpersonate(actor('admin_manager'), target('admin_manager'))).toMatchObject({ ok: false, statusCode: 403 })
    expect(assertMayImpersonate(actor('admin_manager'), target('student'))).toMatchObject({ ok: false, statusCode: 403 })
  })
  it('ولا عن النفس، ولا عن غير النشط', () => {
    expect(assertMayImpersonate(actor('admin_manager', { id: 't' }), target('teacher'))).toMatchObject({ ok: false, statusCode: 400 })
    expect(assertMayImpersonate(actor('admin_manager'), target('teacher', { status: 'disabled' }))).toMatchObject({ ok: false, statusCode: 400 })
  })
  it('⚠️ لا نيابة داخل نيابة — ولو كانت الجلسةُ «مديراً فنياً» (ثغرة الصحابة)', () => {
    expect(assertMayImpersonate(actor('technical_manager', { isImpersonating: true }), target('teacher')))
      .toMatchObject({ ok: false, statusCode: 403 })
  })
  it('ما لم يُسمَّ يُردّ: كلُّ دورٍ غير الفاعلَين', () => {
    for (const r of ['project_supervisor', 'women_admin', 'field_supervisor', 'examiner', 'teacher', 'student'] as Role[]) {
      expect(ok(assertMayImpersonate(actor(r), target('teacher'))), r).toBe(false)
    }
  })
})

describe('impersonationReturnTo', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  it('من القائمة أو من ملفٍّ أو مشرفٍ يعود حيث بدأ', () => {
    expect(impersonationReturnTo('/users', id)).toBe('/users')
    expect(impersonationReturnTo(`/profile/${id}`, id)).toBe(`/profile/${id}`)
    expect(impersonationReturnTo(`/supervisors/${id}`, id)).toBe(`/supervisors/${id}`)
  })
  it('وكلُّ ما سواه ← ملفُّ الهدف (لا رابطَ حرٌّ يقود خارج النظام)', () => {
    for (const bad of ['https://x.y', '//evil', '/users?x=1', '/students', 42, null]) {
      expect(impersonationReturnTo(bad, id)).toBe(`/profile/${id}`)
    }
  })
})

describe('parseImpersonateInput / sessionIdFromAccessToken', () => {
  it('المعرّفُ uuid وحده — ولا بريدَ يُقبل من الطلب', () => {
    expect(parseImpersonateInput({ profileId: 'x' }).ok).toBe(false)
    const p = parseImpersonateInput({ profileId: '11111111-1111-4111-8111-111111111111', email: 'a@b.c' })
    expect(p.ok && p.value).toEqual({ profileId: '11111111-1111-4111-8111-111111111111', from: null })
  })
  it('يقرأ session_id من الرمز، ورمزٌ بلا مطالبةٍ ← null', () => {
    const tok = (o: object) => `h.${Buffer.from(JSON.stringify(o)).toString('base64url')}.s`
    expect(sessionIdFromAccessToken(tok({ session_id: 'abc' }))).toBe('abc')
    expect(sessionIdFromAccessToken(tok({ sub: 'x' }))).toBeNull()
    expect(sessionIdFromAccessToken('garbage')).toBeNull()
  })
})
```

`server/utils/caller.test.ts`: `sessionCanWrite(null)` = true؛ `{ write_until: null }` = false؛ في الماضي = false؛ في المستقبل = true.

`app/constants/impersonation.test.ts`: يقرأ أحدثَ هجرةٍ فيها `create or replace function private.assert_session_writable` ويتحقّق أنّ النصّ بين `raise exception '…'` = `IMPERSONATION_READ_ONLY_MESSAGE`؛ وأنّ `IMPERSONATION_TARGETS` لا تحوي `admin_manager` ولا `student` لأيّ فاعل؛ و`mayImpersonateRole` يطابقها.

`server/utils/impersonationGuardCoverage.test.ts` (منقولٌ من الصحابة بتكييف):

```ts
/**
 * كلُّ مسارٍ يكتب يحمل requireWritableSession — القائمةُ تُشتقّ من الكود لا تُكتب بيد.
 * service_role يتخطّى RLS كلَّها، فحارسُ القاعدة وحدَه يترك مساراتِ الخادم تكتب بالنيابة.
 * والكتابةُ تُقاس بأثرها لا بفعل HTTP.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WRITES = ['.insert(', '.update(', '.upsert(', '.delete(', 'auth.admin.', '.rpc(']
/** ما يشبه الكتابةَ وهو قراءة — بمبدأٍ لا بأسماء ملفات. */
const NOT_REALLY_WRITES: readonly RegExp[] = [
  /auth\.admin\.getUserById\(/g,
  /\.rpc\('claim_employee_number'\)/g // تسلسلٌ لا كتابةَ جدول — والمسارُ كاتبٌ بغيره على أيّ حال
]
/** أبوابُ النيابة نفسِها — حَرْسُها يحبس النائبَ أو يجعل الفتحَ مستحيلاً. */
const EXEMPT = new Set([
  'server/api/impersonate/end.post.ts', // بابُ الخروج: يختم صفَّه ويُبطل جلستَه
  'server/api/impersonate/write-mode.post.ts' // بابُ الكتابة: لا نافذةَ قبل الفتح، وحارسُه دورُ الفاعل في الصفّ
])

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const full = join(dir, n)
  return statSync(full).isDirectory() ? walk(full) : [full]
})
const writes = (src: string) => WRITES.some(w => NOT_REALLY_WRITES.reduce((t, p) => t.replace(p, ''), src).includes(w))

describe('تغطيةُ حارس النيابة', () => {
  it('كلُّ مسارٍ يكتب يستدعي requireWritableSession', () => {
    const missing = walk('server/api')
      .filter(p => p.endsWith('.ts') && !p.endsWith('.test.ts') && !EXEMPT.has(p))
      .filter(p => { const s = readFileSync(p, 'utf8'); return writes(s) && !s.includes('requireWritableSession(') })
    expect(missing, `مساراتُ كتابةٍ بلا حارس:\n${missing.join('\n')}`).toEqual([])
  })
  it('ومساراتُ القراءة لا تُحرس — فالنيابةُ تقرأ', () => {
    for (const p of ['server/api/public/student/[token].get.ts', 'server/api/me/impersonation.get.ts']) {
      const s = readFileSync(p, 'utf8')
      expect(writes(s), `${p} صار يكتب`).toBe(false)
      expect(s).not.toContain('requireWritableSession(')
    }
  })
  it('والمستثنى قليلٌ معروف — يُرفع السقفُ بقرارٍ مكتوب لا بعادة', () => {
    expect(EXEMPT.size).toBeLessThanOrEqual(2)
  })
})
```

`server/utils/impersonationRoutes.test.ts` — حراساتٌ نصّية (بعد تجريد التعليقات): `impersonate.post.ts` يحوي `assertMayImpersonate(` و`isImpersonating` و`requireWritableSession(` و`getUserById` ولا `body.email`؛ و`openSessionFor` يستعمل `createClient(` بـ`persistSession: false`؛ ولا `signOut(` بلا `'local'` في `server/`؛ و`useImpersonation.ts` يحوي `refreshSession(` ولا `setSession(`، و`window.location.replace(`؛ و`useAuth.ts` يحوي `scope: 'local'`.

- [ ] **Step 2:** `pnpm exec vitest run server/utils app/constants/impersonation.test.ts` ← تفشل.

- [ ] **Step 3: التنفيذ**

`server/utils/caller.ts` — منقولٌ من `requireCaller` في الصحابة: `serverSupabaseUser(event)` (ادّعاءات؛ المعرّف في `sub`) ← `401` بلا مستخدم؛ ثم **بالتوازي** (`Promise.all` — لا رحلةٌ إضافيّة لكلّ طلب) `profiles(id, role, status)` بـ`eq('status','active')` وصفّ `impersonation_sessions` بـ`session_id` (إن وُجد)؛ ملفٌّ مفقود ← `403` «هذا الحساب غير مُفعَّل.»؛ **ونيابةٌ انتهت (`expires_at <= now`) ← `401` «انتهت مدّةُ النيابة — عُد إلى حسابك ثمّ ابدأ من جديد.»** (لا يُرفع الوسم، يُردّ الطلب)؛ `canWrite = sessionCanWrite(row)`.

`server/utils/supabaseAdmin.ts` — `requireAdminManager(event)` يصير: `const { caller, admin } = await requireCaller(event)`؛ غيرُ `admin_manager` ← `403` بالرسالة الحاليّة؛ ويُرجع `{ admin, user: { id: caller.id }, caller }` (المساراتُ تستعمل `user.id` وحده — تأكّد بـ`grep`).

المسارات الخمسة: بعد `requireAdminManager` مباشرةً `requireWritableSession(caller)` (استيرادٌ نسبيّ كجيرانه).

`server/utils/impersonationSession.ts` — `openSessionFor`: البريدُ من `admin.auth.admin.getUserById(userId)` **لا من الطلب** (`generateLink` من نوع `magiclink` يُنشئ حساباً لبريدٍ مجهول)؛ `generateLink({ type: 'magiclink', email })` — **لا يرسل بريداً** (والنطاقان الداخليان لا يستقبلان أصلاً)؛ `verifyOtp({ token_hash, type: 'magiclink' })` **بعميلٍ منفصل** `createClient(config.public.supabase.url, config.public.supabase.key, { auth: { persistSession: false, autoRefreshToken: false } })` (عميلُ الطلب يبدّل جلسةَ المدير)؛ `sessionIdFromAccessToken` فارغ ← `admin.auth.admin.signOut(accessToken, 'local')` ثم `500` «رمزٌ بلا معرّف جلسة — لا تُفتح النيابة.».

`server/api/impersonate.post.ts` — الترتيب حرفاً:
1. `const { caller, admin } = await requireCaller(event)`.
2. `if (caller.isImpersonating) throw 403 'لا نيابةَ داخل نيابة — أنهِ النيابةَ الحاليّة أولاً.'` ثم `requireWritableSession(caller)`.
3. `parseImpersonateInput(await readBody(event))` ← `400`.
4. **الكنس:** صفوفُ الفاعل منذ `STALE_SWEEP_HOURS` (`actor_profile_id = caller.id`، `started_at >= since`) ← `rpc('end_impersonation_sessions', { p_session_ids })` لكلّها (المختومُ قد تبقى جلستُه حيّة)، وختمُ المفتوح منها `ended_reason = 'superseded'`.
5. الهدف من `profiles` (`id, full_name, role, status`) — `404` إن لم يوجد؛ ثم `assertMayImpersonate({ id: caller.id, role: caller.role, isImpersonating: caller.isImpersonating }, target)` ← `createError({ statusCode, statusMessage: message })`.
6. اسمُ الفاعل من `profiles.full_name`.
7. `openSessionFor(admin, target.id)`.
8. الإدراج (`session_id`، الاسمان، `actor_role: caller.role`، `expires_at = now + 30m`، `return_to = impersonationReturnTo(from, target.id)`) — **فشلُه ← `rpc('end_impersonation_sessions', [sessionId])`… لكنّ الصفّ غير موجود فلا تُبطَل، فـ`admin.auth.admin.signOut(accessToken, 'local')`** ثم `500` «تعذّر بدء النيابة.» (جلسةٌ بلا صفٍّ يسمها = كاملةُ الكتابة — أسوأُ ما يقع).
9. الردّ: `{ refreshToken, targetName, targetHome: '/dashboard', expiresAt }` (لا `accessToken`).

`server/api/impersonate/end.post.ts` — **بلا `requireCaller`** (يرمي 401 على النيابة المنتهية، وهي أحوجُ ما تكون للإنهاء): `readSessionClaims` ← `401` بلا جلسة؛ الصفّ بـ`session_id` ← `400` «هذه الجلسةُ ليست نيابة.»؛ `parseEndInput` (`resume` افتراضاً `true`):
- `resume = false` (الخروج): ختمُ `ended_reason = 'signed_out'` إن لم يُختم، ثم `end_impersonation_sessions([sessionId])`، والردّ `{ ok: true }`.
- `resume = true`: الفاعلُ من `profiles` — غيرُ نشطٍ أو دورُه ليس في `IMPERSONATOR_ROLES` أو حُذف ← ختمٌ `actor_inactive` + إبطال + `409` «انتهت النيابة — سجّل دخولك من جديد.»؛ وإلا `openSessionFor(admin, actorId)` **أوّلاً**، ثم الختمُ `manual` والإبطال (لو أُبطلت أوّلاً وتعذّرت العودة بقي بلا جلسة)، والردّ `{ refreshToken, returnTo: row.return_to ?? '/users' }`.

`server/api/impersonate/write-mode.post.ts` — بلا `requireCaller` ولا دورِ المنادي (المنادي هو الهدف): `readSessionClaims` ← الصفّ ← `400` إن لم يوجد أو خُتم أو انتهى؛ الفاعلُ من `profiles` الآن: نشطٌ ودورُه في `IMPERSONATOR_ROLES` وإلا `403` «وضعُ التعديل للمدير الإداري والمدير الفني وحدهما.»؛ `parseWriteModeInput`؛ `write_until = on ? min(now + 10m, expires_at) : min(now, expires_at)`؛ التحديث (المشغّل يُشعر عند الفتح)؛ إدراجُ `impersonation_writes` (`op: write_mode_on|off`، `route: '/api/impersonate/write-mode'`)؛ الردّ `{ writeUntil: on ? iso : null }`.

`server/api/me/impersonation.get.ts` — بلا `requireCaller` (المنادي هو الهدف): `readSessionClaims`؛ بلا `sessionId` أو بلا صفّ ← `null` (204)؛ وإلا:

```ts
export interface ImpersonationStatus {
  targetName: string
  actorName: string
  actorRole: ImpersonatorRole
  expiresAt: string
  writeUntil: string | null
  /** المختومةُ تُعرض شريطاً ما دامت الجلسةُ تعمل — شريطٌ يختفي وجلسةٌ باقية هو ما بُني هذا لمنعه. */
  ended: boolean
}
```
**قراءةٌ خالصة** (لا كنسَ هنا: إبطالُ الجلسة قبل `end` يُسقط ادّعاءاتها فيتعذّر الرجوع).

- [ ] **Step 4:** الاختبارات تمرّ؛ `pnpm lint && pnpm test`؛ vue-tsc (server + app) بلا جديد؛ `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3030/api/impersonate` بلا جلسة ← 401، و`GET /api/me/impersonation` ← 204.
- [ ] **Step 5: Commit** `feat(impersonation): مساراتُ النيابة والمستدعي وحارسُ الجلسة الكاتبة في كلّ مسارٍ يكتب`

---

### Task 4: الواجهة — الشريط وزرّ «ادخل بحسابه» وما يتغيّر في النيابة

**Files:**
- Create: `app/utils/impersonation.ts` (+test)، `app/composables/useImpersonation.ts` (+test)، `app/components/impersonation/Bar.vue`، `app/components/impersonation/StartButton.vue`
- Modify: `app/layouts/dashboard.vue`، `app/composables/useAuth.ts`، `app/middleware/auth.global.ts`، `app/utils/accountGate.ts` (+test)، `app/pages/change-password.vue`، `app/components/NotificationsBell.vue`، `app/composables/useInbox.ts`، `app/pages/users/index.vue`، `app/pages/profile/[id].vue`، `app/composables/useProfilePhoto.ts` · `useMyPhoto.ts` · `useUpload.ts` · `useTransactionDocs.ts` (فحصٌ قبل الرفع)

**Interfaces:**
- Consumes (Task 3): المسارات الأربعة، `ImpersonationStatus`، ثوابت `app/constants/impersonation.ts`.
- Produces:

```ts
// app/utils/impersonation.ts — نقيّ
export function clockLabel(iso: string): string                      // 'HH:MM' بأرقامٍ لاتينية وبتوقيت Asia/Gaza (Intl بـnu-latn)
export function countdownLabel(untilIso: string, nowMs: number): string // 'mm:ss'، لا يقلّ عن '00:00'
export function writeOpen(s: Pick<ImpersonationStatus, 'writeUntil'> | null, nowMs: number): boolean
export function expired(s: Pick<ImpersonationStatus, 'expiresAt'> | null, nowMs: number): boolean
export function impersonateConfirmText(name: string): { title: string, lines: string[] }
//   title: 'الدخول بحساب <name>'
//   lines: ['تفتح شاشته كما يراها، قراءةً فقط', 'يصله إشعارٌ بأنّك اطّلعت على حسابه', 'تنتهي بعد نصف ساعة']

// app/composables/useImpersonation.ts
export function useImpersonation(): {
  state: Ref<ImpersonationStatus | null>
  isChecked: Ref<boolean>
  refresh(): Promise<void>            // GET /api/me/impersonation؛ تعثّرُ الشبكة لا يُخفي شريطاً ظاهراً
  ensureChecked(): Promise<ImpersonationStatus | null>   // مرّةً في عمر الصفحة
  start(profileId: string): Promise<void>                // from = route.fullPath ← refreshSession ← window.location.replace(targetHome)
  end(opts?: { resume?: boolean }): Promise<void>        // resume: refreshSession ← location.replace(returnTo)
  setWriteMode(on: boolean): Promise<void>               // ثم refresh() — الخادمُ الحَكَم
  isReadOnlyNow(): boolean                               // دالّةٌ لا computed: الوقتُ يمضي ولا يتغيّر شيء في الذاكرة
  blockIfReadOnly(): void                                // يرمي Error(IMPERSONATION_READ_ONLY_MESSAGE)
}
```

- [ ] **Step 1: TDD لـ`app/utils/impersonation.ts`** — `clockLabel('2026-10-20T12:05:00Z')` = `'15:05'` (غزة +3 في 10-2026)؛ `countdownLabel` لـ 9:05 و0 والماضي؛ `writeOpen` (null، ماضٍ، مستقبل)؛ `expired`؛ نصّ التأكيد حرفاً كالمواصفة. و`accountGate.test.ts`: `accountGateDecision(profile{must_change_password:true}, '/dashboard', false, { impersonating: true })` = `'allow'` (لا يُساق المديرُ إلى تغيير كلمةِ غيره)، والسلوكُ القديم بلا الخيار كما هو.

- [ ] **Step 2: `useImpersonation`** — منقولٌ من الصحابة (`state` بـ`useState('impersonation')`، `isChecked`): `start` يرسل `{ profileId, from: route.fullPath }` ثم `client.auth.refreshSession({ refresh_token })` — **لا `setSession`** — فإن فشل ← `Error('تعذّر تبديلُ الجلسة.')`، ثم `window.location.replace(targetHome)` (**تحميلٌ كامل**: `current-profile` وروابطُ الصور الموقَّعة في الذاكرة لصاحب الجلسة السابقة). `end({ resume: true })` كذلك بـ`returnTo`؛ وإن ردّ الخادم `401/409` ← `client.auth.signOut({ scope: 'local' })` ثم `location.replace('/login')` مع رسالة «انتهت النيابة — سجّل دخولك من جديد.». اختبارُ المركّب (`useImpersonation.test.ts`) على الأجزاء المحقونة كنمط `useChangePassword`: `applyStart(result, steps)` يستدعي `refreshSession` ثم `replace` بالترتيب، ولا يستدعي `replace` إن فشل التبديل.

- [ ] **Step 3: `Bar.vue`** (JSDoc عربيّ؛ ≤ 300 سطر) — يظهر حين `state !== null`؛ `role="status"` و`aria-live="polite"`:
  - **أصفر (قراءة):** «أنت تتصفّح بحساب **{targetName}** · قراءةٌ فقط · تنتهي {clockLabel(expiresAt)}» + زرّ «فعّل التعديل — 10 دقائق» (`i-lucide-pencil`) + «إنهاء النيابة» (`i-lucide-log-out`).
  - **أحمر (تعديل):** «أنت تعدّل باسم **{targetName}** — كلُّ تعديلٍ مسجَّل · {countdownLabel}» + «أوقف التعديل» + «إنهاء النيابة».
  - نبضةٌ كلَّ ثانية (`setInterval` يُنظَّف في `onUnmounted`)؛ عند انغلاق النافذة ← `refresh()` (لا تبديلَ لونٍ محلّياً)؛ **عند `expired` ← رسالة «انتهت مدّةُ النيابة — تعود إلى حسابك.» ثم `end()` مرّةً واحدة**؛ و`ended: true` يُعامَل كذلك.
  - ألوانٌ بالتوكنز (أضف إلى `main.css` إن لم توجد: `--imp-read-bg/--imp-read-ink` و`--imp-write-bg/--imp-write-ink` للوضعين الفاتح والليليّ)؛ الأزرار ≥ 44px؛ على 375px يلتفّ النصّ فوق الأزرار بلا تمرير أفقيّ.
  - الأخطاء عبر `useErrorHandler().handle(err, 'تعذّر …')`.

- [ ] **Step 4: `StartButton.vue`** — props `{ profileId: string, name: string, role: Role, status: string, size?: 'sm' | 'lg' }`؛ يظهر حين: دورُ المستخدم في `IMPERSONATOR_ROLES`، و`mayImpersonateRole(myRole, role)`، و`status === 'active'`، و`profileId !== myId`، **و`useImpersonation().state === null`** (لا نيابة داخل نيابة — والخادمُ الحَكَم). زرّ «ادخل بحسابه» (`i-lucide-eye`) يفتح `UiConfirmModal` بنصّ `impersonateConfirmText(name)` وزرّ تأكيد «ادخل» ← `start(profileId)` (تحميلٌ على الزرّ؛ الخطأ عبر `handle`).

- [ ] **Step 5: الدمج في الشاشات (سطورُ استدعاءٍ لا منطق)**
  - `app/layouts/dashboard.vue`: `<ImpersonationBar />` أعلى العمود الرئيس فوق `.topbar` (ثابتٌ لا يُخفى في شاشة)، و`useImpersonation().ensureChecked()` في `onMounted` (طلبٌ واحد لكلّ تحميلٍ كامل، غيرُ حاجز).
  - `app/composables/useAuth.ts` — `signOut()`: `const s = await useImpersonation().ensureChecked()`؛ إن كان نيابةً ← `$fetch('/api/impersonate/end', { method: 'POST', body: { resume: false } })` (يُبتلع خطؤه بتسجيل) ثم `supabase.auth.signOut({ scope: 'local' })`؛ وإلا السلوكُ الحاليّ. **علّتُه:** `signOut()` بلا نطاق = `global` = إخراجُ الموظف الحقيقيّ من كلّ أجهزته.
  - `app/middleware/auth.global.ts` + `accountGate.ts`: حين يقضي الحاجز بـ`change-password` (نادر) يُسأل `ensureChecked()`، فإن كان نيابةً ← `allow`.
  - `app/pages/change-password.vue`: في النيابة `UAlert` «لا تُغيَّر كلمةُ مرور غيرك بالنيابة.» والنموذجُ معطَّل (والحارسُ الحقيقيّ مشغّلُ `auth.users`).
  - `app/pages/profile/[id].vue`: زرّ «تغيير كلمة المرور» و`ProfilePasswordBanner` بشرط `isSelf && !impersonating`؛ و`<ImpersonationStartButton>` في `band-actions` لغير صاحب الملف.
  - `app/pages/users/index.vue`: `<ImpersonationStartButton size="sm">` في `#actions` بجانب «عرض البيانات» (يظهر للمدير الإداري؛ مشرفُ المشروع لا).
  - `app/components/NotificationsBell.vue` + `useInbox.ts`: في النيابة يُخفى «تعليم الكل مقروءاً»، و`markRead` يعود فوراً بلا نداء (والقاعدة تردّ 0 على أيّ حال). الاشتراك الحيّ يبقى (قراءة).
  - مكوّنات الرفع (`useProfilePhoto`/`useMyPhoto`/`useUpload`/`useTransactionDocs`): `blockIfReadOnly()` قبل الرفع — رسالةُ المستودع عند رفض السياسة إنجليزيةٌ عامّة، فالفحصُ المسبق تجربةٌ أوضح (والحارسُ في القاعدة).
  - **قرار ١ (بانتظار المستخدم):** مدخلُ المدير الفني إلى المعلمين والمختبِرين — انظر «قراراتٌ للمستخدم».

- [ ] **Step 6:** `pnpm lint && pnpm test`؛ vue-tsc بلا جديد؛ افتح `/users` و`/profile/<id>` و`/change-password` على 3030 بجلسة المستخدم إن كانت مفتوحة، وسجلُّ الخادم نظيف — **لا نيابةَ حقيقيةَ في هذه المهمّة**.
- [ ] **Step 7: Commit** `feat(impersonation): الشريطُ وزرُّ «ادخل بحسابه» والخروجُ والجرسُ في النيابة`

---

### Task 5: التحقّق في المتصفّح والتوثيق (المتحكّم)

- [ ] **قبل البدء:** في لوحة Supabase ← Auth: تأكّد أنّ **«Single session per user» مطفأ** (لو كان مفعّلاً لأخرجت جلسةُ النيابة الموظفَ من جهازه). واقرأ `select count(*) from public.impersonation_sessions` = 0.
- [ ] **المتصفّح** (المستخدم يُدخل حسابَي المدير الإداري والمعلم التجريبيّ؛ لا كلماتِ مرورٍ في المحادثة ولا الملفات):
  1. المدير الإداري ← `/users` ← «ادخل بحسابه» للمعلم التجريبيّ ← نافذةُ التأكيد بنصّ المواصفة ← تُفتح لوحةُ المعلم والشريطُ أصفر «… قراءةٌ فقط · تنتهي HH:MM»؛ `F5` ← الشريطُ باقٍ.
  2. محاولاتُ كتابةٍ قراءةً: فتحُ يوم حضور، رصدٌ قرآنيّ، تعديلُ بيانات الملف، رفعُ صورة ← كلُّها تُرفض بـ«أنت تتصفّح بالنيابة — قراءةٌ فقط…»؛ «تغيير كلمة المرور» غائب؛ الجرسُ يعرض إشعاراتِ المعلم ولا يعلّمها مقروءة.
  3. «فعّل التعديل — 10 دقائق» ← الشريطُ أحمرُ بعدٍّ تنازليّ؛ تعليمُ غيابٍ واحد ← يُحفظ، وصفٌّ في `impersonation_writes` بصورته (`execute_sql` قراءةً)؛ «أوقف التعديل» ← أصفر، والكتابةُ تُرفض ثانيةً.
  4. المعلم (لسانٌ آخر/متصفّحٌ آخر بجلسته الحقيقية) ← إشعارا «اطّلع المدير الإداري على حسابك» و«فتح المدير الإداري التعديلَ في حسابك»، وجلستُه **لم تخرج** وهو يكتب بلا عائق أثناء النيابة.
  5. «إنهاء النيابة» ← العودةُ إلى `/users` بحساب المدير الإداري؛ `auth.sessions` لم تعد فيها جلسةُ النيابة.
  6. نيابةٌ ثانية ثم «تسجيل الخروج» من القائمة ← صفحةُ الدخول؛ وجلسةُ المعلم الحقيقية باقية.
  7. 375px: الشريطُ يلتفّ بلا تمرير أفقيّ.
  8. **بعد التجربة:** يومُ الحضور التجريبيّ يُحذف بالمعرّف **بإذن المستخدم**؛ صفوفُ `impersonation_sessions/writes` **تبقى** (سجلٌّ لا يُحذف).
- [ ] **التوثيق:** `docs/DATABASE.md` §24 جديد «الدخول بالنيابة» (الجدولان، الحارسان، `assert_session_writable`، السياساتُ التقييديّة `impersonation_ro_*` على كلّ جدول و`storage.objects`، `guard_table_for_impersonation` **إلزاميّةٌ لكلّ جدولٍ جديد**، مشغّلُ السجلّ، المُنتِجان، `end_impersonation_sessions`، حارسُ `auth.users`، والكنس) وسطرُ الحالة أعلى الملف؛ و§17 (`revoke_sessions` ≠ `end_impersonation_sessions`)؛ `docs/FEATURES.md` (بند + Changelog)؛ `docs/PAGES.md` (`/users` و`/profile/[id]` والشريط)؛ `docs/ROADMAP.md` (البند 36 ✅ «الدخول بالنيابة»، والدفعة الثانية: الجزء ٥ ✅)؛ و`CLAUDE.md`: في «قواعد الأمن» سطرا «كلُّ جدولٍ جديد ← `private.guard_table_for_impersonation('public.x')` في هجرته، وكلُّ دالّة definer كاتبة ← `perform private.assert_session_writable()`، وكلُّ مسارٍ خادميّ كاتب ← `requireWritableSession(caller)`»، وصفٌّ في المصفوفة «الدخول بالنيابة (قراءة + تعديل 10 دقائق مسجَّل)»: م.م ❌ · إدا ✅ (عن كلّ موظفٍ نشط ومنهم الفني) · فني ✅ (عن كلّ موظفٍ نشط إلا الإداري) · مدي ❌ · ميد ❌ · مخت ❌ · معل ❌ · طال ❌؛ ثم وثيقةُ السيناريوهات بعد النشر.
- [ ] **Commit** `docs(impersonation): توثيقُ الدخول بالنيابة`

---

### Task 6: (محجوز للمراجعة النهائية وإصلاحاتها)

---

## المخاطر والحالات الحدّية

| الحالة | ما يقع | المعالجة في هذه الخطة |
|---|---|---|
| **الاشتراك الحيّ (Realtime)** أثناء النيابة | قناة `notifications` تُفتح برمز الهدف فتصل إشعاراتُه (ومنها `impersonation_started` نفسُه) ويرنّ الجرس | قراءةٌ مشروعة؛ التحميلُ الكامل عند البدء والإنهاء يُغلق القناة القديمة ويفتح الجديدة؛ لا تعليمَ مقروءاً. بعد الإبطال تبقى القناةُ حتى انتهاء الرمز (≤ ساعة) — والإنهاءُ تحميلٌ كامل يقطعها |
| **ذاكرةُ التطبيق وعاملُ الخدمة** | `current-profile` وروابطُ الصور الموقَّعة في `useState` لصاحب الجلسة السابقة | `window.location.replace` في البدء والإنهاء يمحو الذاكرة؛ عاملُ الخدمة لا يخزّن بياناتٍ (`navigateFallback: null`، لا استدعاءات Supabase)؛ `localStorage` لشريط التثبيت وحدَه |
| **الخروج أثناء النيابة** | `signOut()` الافتراضيّ `global` يُخرج الموظف من كلّ أجهزته | `end({ resume:false })` ثم `signOut({ scope:'local' })` (Task 4)، وفي الخادم `signOut(token, 'local')` |
| **انتهاء المدّة (30 د)** | الخادمُ يردّ 401 من `requireCaller`؛ PostgREST يبقى يقرأ ما دامت الجلسةُ حيّة، والكتابةُ مقفلةٌ أبداً | الشريطُ يُنهي عند الصفر؛ `end` بلا `requireCaller` يعمل على المنتهية؛ وإن تعذّرت العودة ← خروجٌ محلّيّ إلى `/login`؛ اللسانُ المغلق ← الكنسُ (Task 2ب إن أُذن، وإلا كنسُ الفاعل التالي) |
| **الجرس** | تعليمُ إشعارات الهدف مقروءةً يُخفيها عنه | `mark_notifications_read` تردّ 0 في كلّ نيابة؛ الواجهةُ لا تنادي |
| **طوابيرُ العمل بلا إنترنت** | لا طابورَ في ترجمان اليوم (الحضور بلا إنترنت مؤجَّل — ROADMAP #14) | يُوثَّق في `DATABASE.md`: الطابورُ حين يُبنى يرفض الإدراجَ في نيابة القراءة ولا يُفرَّغ تحت جلسة نيابة (نمط `useOfflineSync` في الصحابة) |
| **رفعُ الملفات** (صورٌ شخصية، مرفقاتُ المالية، الإعلام) | السياسةُ التقييديّة على `storage.objects` ترفض برسالةٍ قد تصل عامّة | `blockIfReadOnly()` قبل الرفع؛ في وضع التعديل يمرّ الرفع **ولا يُسجَّل في `impersonation_writes`** (لا مشغّلات منّا على `storage.objects`) — ما يُكتب معه في `profiles.photo_path` يُسجَّل |
| **كلمةُ المرور/البريد** عبر GoTrue | خارج RLS | مشغّلُ `auth.users` (Task 1) — **أثرٌ جانبيّ:** الموظفُ نفسُه لا يغيّر كلمته ما دامت عليه جلسةُ نيابةٍ حيّة؛ وإعادةُ التعيين من المدير الإداري تمرّ (ترفع العلَم فتُبطل الجلسة أوّلاً) |
| **تعطيلُ الهدف أو تغييرُ دوره أثناء النيابة** | `profiles_revoke_sessions` يُبطل كلَّ جلساته ومنها النيابة | `end` قد يعجز عن قراءة الادّعاءات (إن كان `getClaims` يتحقّق من الخادم) ← خروجٌ محلّيّ إلى `/login` برسالة |
| **تعطيلُ الفاعل أثناء النيابة** | — | `end` يرفض إصدار جلسة عودة (`actor_inactive` + `409`)؛ `write-mode` يقرأ دورَ الفاعل الحاليّ لا المصوَّر |
| **MFA** | الجلسةُ تستطيع تسجيل عاملٍ ثانٍ (`mfa.enroll`) للهدف | لا يُفرض AAL2 في ترجمان فلا قفل؛ يُذكر في `DATABASE.md` خطراً معروفاً |
| **حدُّ `verifyOtp` لكلّ IP** | كلُّ بدءٍ وإنهاءٍ تحقّقٌ من عناوين Vercel | الاستعمالُ دقائقُ في الشهر؛ رسالةُ 429 تُترجم «محاولات كثيرة…» |
| **جلساتُ الفاعل اليتيمة** | جلستُه الأصلية تبقى في `auth.sessions` بلا من يحمل رمزَها | خاملةٌ؛ تُصدَر له جلسةٌ جديدة عند الإنهاء (نمط الصحابة) |

## قراراتٌ للمستخدم

1. **مدخلُ المدير الفني:** `/users` اليوم للمدير الإداري ومشرف المشروع وحدهما، والمدير الفني لا يبلغ ملفَّ معلّمٍ أو مختبِر إلا عبر `/supervisors/[id]` (للمشرفين). **التوصية:** فتحُ `/users` للمدير الفني **قائمةً للقراءة** (الأزرارُ الكاتبة فيها `isAdmin` أصلاً) فيظهر له «ادخل بحسابه» — سطرٌ في `mainNav` و`canView`. البديل: ربطُ أسماء المعلم والمشرف والمختبِر في `/halqat/[id]` بملفّاتهم.
2. **كنسُ الجلسات المنتهية بـ`pg_cron` كلَّ 5 دقائق (Task 2ب):** تفعيلُ إضافة `pg_cron` على الإنتاج. **التوصية: نعم** — بدونه تبقى جلسةُ لسانٍ مغلق قراءةً حيّةً حتى بدء الفاعل التالي، ويُمنع الموظفُ في أثنائها من تغيير كلمة مروره.
