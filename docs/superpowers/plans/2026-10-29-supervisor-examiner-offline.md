# المشرف الميداني والمختبِر بلا إنترنت — خطّة البناء

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**الغاية:** أن يقيّم المشرفُ الميدانيّ زيارتَه ويرصد المختبِرُ درجاتِه بلا إنترنت، فيُحفظ العملُ على الجهاز ويُرفع وحده عند عودة الاتصال بتاريخ وقوعه.

**البنية:** تُعمَّم آليةُ المعلّم القائمة (نُسخُ الشاشات `useOfflineCopy`، وصناديقُ الرفع `defineOfflineQueue`، وحارسُ التنقّل) من دورٍ واحدٍ إلى ثلاثة. ثم يُضاف صندوقان جديدان: `visit_outbox` و`exam_outbox` في قاعدة الجهاز بنسختها 5، ولكلٍّ منهما أداةٌ نقيّة مختبَرة وcomposable يربطها بالشاشة. ولا تغيير في قاعدة البيانات.

**التقنية:** Nuxt 4 · Vue 3 Composition API · TypeScript strict · @nuxt/ui v4 · Supabase · IndexedDB · Vitest · pnpm.

**التصميم:** `docs/superpowers/specs/2026-10-29-supervisor-examiner-offline-design.md`. اقرأه قبل أيّ مهمّة.

## القيود العامّة

- **لا هجرة**، ولا تغييرَ في حرّاس القاعدة ولا سياساتها.
- سلوكُ **المعلّم** بلا اتصال لا يتغيّر: شاشاتُه، وتحويلاتُه، ونُسخُه، وصناديقُه. وتبقى اختباراتُه القائمة خضراء.
- الأدوارُ التي تعمل بلا اتصال بعد هذا العمل: `teacher`، و`field_supervisor`، و`examiner` وحدها. المديرُ الفنيّ والمديران يبقون متّصلين.
- **أثناء النيابة** على مشرفٍ أو مختبِر لا تُحفظ نسخٌ ولا يُوضع شيءٌ في صندوق.
- قاعدةُ الجهاز `OFFLINE_DB_VERSION = 5`، بمخزنين جديدين `visit_outbox` و`exam_outbox` (`keyPath: 'key'`)، ولا يُمسّ مخزنٌ قائم.
- الرفعُ بجلسة صاحب السطر وحدها. وهذا قائمٌ في `useOfflineQueue`، فلا يُكرَّر.
- **التواريخ تُثبَّت ساعةَ الحفظ على الجهاز لا ساعةَ الرفع:** `executed_at` للزيارة، و`exam_date` للنتيجة. وكلُّ الأيام بتوقيت غزة (`gazaToday`، `executedAtFromDay`).
- **النصوص الظاهرة حرفياً:**
  - شارةُ ما ينتظر الرفع: `على جهازك — بانتظار الرفع`.
  - بعد حفظ الزيارة بلا اتصال: `حُفظ التقييم على جهازك، ويُرفع حين يعود الاتصال.`
  - بعد حفظ النتيجة بلا اتصال: `حُفظت النتيجة على جهازك، وتُرفع حين يعود الاتصال.`
  - رفضُ نتيجةٍ رصدها غيرُه: `رُصدت نتيجةُ هذا الطالب قبل رفع نتيجتك.`
  - رفضُ زيارةٍ لم تُحفظ: `لم تُحفظ الزيارة — ليست ضمن صلاحيتك أو حُذفت.`
  - تلميحُ الأزرار المعطّلة: `يحتاج اتصالاً`.
  - مكانُ النتائج السابقة بلا اتصال: `النتائج السابقة تحتاج اتصالاً.`
- الأزرارُ والمساحاتُ اللمسية ≥ 44px، وRTL، والوضعان الفاتح والليلي، والألوانُ من متغيّرات CSS لا قيمٌ مباشرة.
- **لا ملفٌّ جديدٌ يتجاوز 300 سطر.** والملفّاتُ القائمة فوق الحدّ (`visits/index.vue` 442 و`ResultModal.vue` 315) لا تُزاد إلا بأقلّ ما يلزم، والمنطقُ يذهب إلى `utils/` والـcomposables.
- كلُّ composable جديد له ملفُّ `*.test.ts`، وكلُّ أداةٍ نقيّة جديدة كذلك.
- التعديلُ بأدوات Write/Edit لا بسكربتات الصَّدفة.
- **قبل لمس** `nuxt.config.ts`، أو `app/constants/navigation.ts`، أو `app/pages/visits/index.vue`، أو `app/components/visits/*`، أو `app/components/exams/*`: يُرسل المنسِّقُ (لا المنفِّذ) تنبيهاً إلى الجلسة الأخرى العاملة على المستودع.
- **أوامر التحقّق:**
  - `pnpm vitest run <path>` للاختبار المعيّن، و`pnpm test` للكلّ.
  - `pnpm lint`.
  - `pnpm typecheck`: له ثلاثة أخطاءٍ معروفةٍ سابقةٍ في ملفّات جلسةٍ أخرى (`NewsSlider.vue:66`، `rewrite.post.ts:20-22`)، ولا يُقبل خطأٌ غيرها.
- **رسائلُ الإيداع** Conventional، وتنتهي بالسطر:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- بعد كلّ إيداع: `git branch --show-current` يجب أن يقول `feature/v2-batch2`.

## محطّاتُ المراجعة

هذه أخطر خمسة مواضع لا يكشفها الاستعمالُ العاديّ، ولكلٍّ اختبارٌ في مهمّته:

1. **مشرفٌ حفظ زيارةً بلا اتصال، ثم أعاد فتحها قبل الرفع.** يراها للقراءة بعدّه وملاحظاته، لا فارغةً ولا قابلةً للتعديل. ← المهمّة 4 (`applyPendingVisits`) والمهمّة 5.
2. **ردٌّ ضائع في رفع النتيجة.** نجح الإدراجُ ولم يصل الردّ، فتُعاد المحاولة وتأتي `23505`. والراصدُ هو صاحبُ السطر، فيُعدّ ذلك نجاحاً لا رفضاً. ← المهمّة 6.
3. **إقلاعٌ باردٌ بلا اتصال من `/` على جهاز مشرف.** يذهب إلى `/visits`، لا إلى `/t/home`، ولا يدور التحويلُ في حلقة. ← المهمّة 2 (`offlineRedirect`) والمهمّة 8 (علامة `current`).
4. **حفظٌ قبل منتصف الليل ورفعٌ بعده.** `exam_date` و`executed_at` تبقيان يومَ الحفظ. ← المهمّتان 4 و6.
5. **درجةُ النجاح غيرُ محفوظةٍ على الجهاز.** لا يُعرض «اجتاز» ولا «لم يجتز» بقيمةٍ افتراضية. ← المهمّة 6 (`passVerdict`).

---

### المهمّة 1: «صاحبُ الجهاز» لثلاثة أدوار، وعلَمُ النيابة

**الملفّات:**
- تعديل: `app/utils/offlineSnapshot.ts`
- تعديل: `app/utils/impersonation.ts`
- تعديل: `app/composables/useImpersonation.ts` (حيث تُكتب حالةُ النيابة `state`)
- تعديل: `app/composables/useOfflineCopy.ts` (سطرُ `offlineTeacherUid()` ← `offlineOwnerUid()`)
- اختبار: `app/utils/offlineSnapshot.test.ts`، `app/utils/impersonation.test.ts`

**الواجهات:**
- تُنتج: من `utils/offlineSnapshot.ts`:
  - `export type OfflineOwnerRole = 'teacher' | 'field_supervisor' | 'examiner'`
  - `export function offlineOwnerRole(): OfflineOwnerRole | null` — دورُ الملفّ المحفوظ (`PROFILE_CACHE_KEY`) إن كان من الثلاثة، وإلا null.
  - `export function offlineOwnerUid(): string | null` — المعرّفُ لأدوار `OfflineOwnerRole`. ويردّ null للمشرف والمختبِر حين `impersonatingNow()`. أمّا المعلّم فكما هو اليوم دون شرط النيابة.
  - و`offlineTeacherUid()` **تبقى كما هي**، فتظلّ `useOfflineAck` و`useIncentiveOffline` للمعلّم وحده.
- تُنتج: من `utils/impersonation.ts`:
  - `export function setImpersonatingNow(on: boolean): void`
  - `export function impersonatingNow(): boolean`

  متغيّرٌ على مستوى الوحدة، يُقرأ بلا سياق Nuxt.
- `useImpersonation.ts` تنادي `setImpersonatingNow(!!s && !s.ended)` كلّما تغيّرت حالةُ النيابة، ومنها مسحُها عند الخروج.

- [ ] **الخطوة 1: الاختبارات الفاشلة.** تُكتب في `offlineSnapshot.test.ts` على نمط ملفّه القائم في محاكاة `readCache`/`localStorage`:
  - `offlineOwnerUid يردّ المعرّف للمشرف الميدانيّ والمختبِر` — ملفٌّ `{ id: 'u1', role: 'field_supervisor' }` ← `'u1'`، و`examiner` ← `'u1'`.
  - `offlineOwnerUid يردّ null للمدير الإداري والفنيّ` — `admin_manager` ← `null`، و`technical_manager` ← `null`.
  - `أثناء النيابة لا صاحبَ للمشرف ويبقى للمعلّم` — `setImpersonatingNow(true)`، ثم مشرفٌ ← `null`، ومعلّمٌ ← `'u1'`. ثم `setImpersonatingNow(false)` في `afterEach`.
  - `offlineTeacherUid لا يتغيّر` — مشرفٌ ← `null`.
  - `offlineOwnerRole` ← `'examiner'` لملفّ مختبِر، و`null` بلا ملفّ.
- [ ] **الخطوة 2:** `pnpm vitest run app/utils/offlineSnapshot.test.ts`. المتوقّع: يفشل لغياب الدوالّ.
- [ ] **الخطوة 3:** تُنفَّذ الدوالُّ أعلاه، ويُربط `setImpersonatingNow` في `useImpersonation.ts`، ويُبدَّل النداءُ في `useOfflineCopy.ts`، ويُحدَّث تعليقُ رأس `useOfflineCopy.ts` و`offlineSnapshot.ts` ليقولا «المعلّم والمشرف الميدانيّ والمختبِر».
- [ ] **الخطوة 4:** `pnpm vitest run app/utils app/composables/useOfflineCopy.test.ts`. المتوقّع: PASS كلّه.
- [ ] **الخطوة 5:** إيداعٌ برسالة: `feat: نسخُ الشاشات على الجهاز للمشرف الميدانيّ والمختبِر`

---

### المهمّة 2: الشاشاتُ بلا اتصال لكلّ دور، والإقلاع

**الملفّات:**
- تعديل: `app/constants/navigation.ts`
- تعديل: `app/constants/offline.ts`
- تعديل: `app/middleware/auth.global.ts`
- تعديل: `app/composables/useOfflineNav.ts`
- تعديل: `app/pages/t/home.vue` (السطر 12)
- تعديل: `app/utils/offlineDb.ts` (`hasOfflineTeacher` ← `hasOfflineOwner` بالجسم نفسه)، ويُعدَّل مستدعيها الوحيد في الوسيط
- تعديل: `nuxt.config.ts`:
  - `routeRules`: `'/exams': { ssr: false, prerender: true }`؛
  - `navigateFallbackAllowlist`: يُضاف `exams` إلى التعبير الثاني.
- اختبار: `app/constants/navigation.test.ts`، `app/composables/useOfflineNav.test.ts`

**الواجهات:**
- تستهلك: `offlineOwnerRole()` و`OfflineOwnerRole` من المهمّة 1.
- تُنتج: من `constants/offline.ts`:
  - `export const OFFLINE_SUPERVISOR_HOME = '/visits'`
  - `export const OFFLINE_EXAMINER_HOME = '/exams'`
  - `export function offlineStartFor(role: OfflineOwnerRole | null): string` — المعلّم أو null ← `OFFLINE_DASHBOARD`، والمشرف ← `/visits`، والمختبِر ← `/exams`.
- تُنتج: من `constants/navigation.ts`:
  - `export const SUPERVISOR_OFFLINE_PATHS = ['/visits', '/profile/me']`
  - `export const EXAMINER_OFFLINE_PATHS = ['/exams', '/profile/me']`
  - `export function offlinePathsFor(role: OfflineOwnerRole | null): readonly string[]` — المعلّم أو null ← `OFFLINE_PATHS` بلا تغيير.
  - `export function offlineRedirect(path: string, role: OfflineOwnerRole | null): string | null` — وجهةُ التحويل بلا اتصال. يردّ null إن كان المسارُ مسموحاً لهذا الدور. وللمعلّم أو null يحفظ منطقَ الوسيط القائم حرفاً بحرف (`/reports` ← `OFFLINE_QURAN`، و`/attendance` ← `OFFLINE_HOME`، و`/students…` ← `/t/students`، وغيرُها ← `OFFLINE_DASHBOARD`). وللمشرف والمختبِر يردّ `offlineStartFor(role)`.
- الوسيط يصير: `const role = offlineOwnerRole()`، ثم `if (offlinePathsFor(role).includes(to.path)) return`، ثم الاستثناءاتُ العامّة كما هي، ثم `navigateTo(offlineRedirect(to.path, role))`. وشرطُ `/` يقرأ `hasOfflineOwner()`.
- `useOfflineNav`: تقرأ `offlinePathsFor(offlineOwnerRole())` بدل `OFFLINE_PATHS`.
- `t/home.vue`: غيرُ المعلّم بلا اتصال ← `navigateTo(offlineStartFor(offlineOwnerRole()), { replace: true })`، ومتّصلاً ← `/dashboard` كما هو.

- [ ] **الخطوة 1: الاختبارات الفاشلة** في `navigation.test.ts`:
  - `offlinePathsFor للمعلّم هي OFFLINE_PATHS نفسها` — `toBe(OFFLINE_PATHS)`.
  - `المختبِر يعمل على /exams والمعلّم لا` — `offlinePathsFor('examiner')` تحوي `/exams`، و`offlinePathsFor('teacher')` لا تحويها.
  - `المشرف لا يعمل على /t/home` — `offlinePathsFor('field_supervisor')` لا تحوي `/t/home`.
  - `offlineRedirect يحفظ تحويلات المعلّم` — `('/reports','teacher')` ← `'/t/quran'`، و`('/attendance','teacher')` ← `'/t'`، و`('/students/x','teacher')` ← `'/t/students'`، و`('/dashboard','teacher')` ← `'/t/home'`، و`('/visits','teacher')` ← `null`.
  - `offlineRedirect للمشرف والمختبِر إلى شاشتيهما` — `('/dashboard','field_supervisor')` ← `'/visits'`، و`('/t/home','examiner')` ← `'/exams'`، و`('/exams','examiner')` ← `null`.

  وفي `useOfflineNav.test.ts`: `رابطُ /exams يعمل للمختبِر بلا اتصال ويُعتَم للمعلّم`.
- [ ] **الخطوة 2:** `pnpm vitest run app/constants/navigation.test.ts app/composables/useOfflineNav.test.ts`. المتوقّع: FAIL.
- [ ] **الخطوة 3:** يُنفَّذ ما في الواجهات.
- [ ] **الخطوة 4:** الأمرُ نفسه، ثم `pnpm test`. المتوقّع: PASS كلّه، ومنه `useNetworkStatus.test.ts` القائم.
- [ ] **الخطوة 5:** إيداعٌ برسالة: `feat: شاشاتٌ بلا اتصال بحسب الدور وإقلاعُ المشرف والمختبِر`

---

### المهمّة 3: قاعدةُ الجهاز 5 بمخزنين جديدين

**الملفّات:**
- تعديل: `app/constants/offline.ts` (`OFFLINE_DB_VERSION = 5`)
- تعديل: `app/utils/offlineDb.ts`:
  - `StoreName` يُضاف إليه `'visit_outbox' | 'exam_outbox'`؛
  - يُضاف سطرا `createObjectStore` بالشرط نفسه وبتعليق «النسخة 5 (2026-10-29)»؛
  - يُحدَّث تعليقُ الرأس.
- اختبار: لا محاكاةَ لـIndexedDB في الحزم (`fake-indexeddb` غائبة)، ولا تُضاف حزمة. فالتحقّقُ بالخطوة 2 هنا، وبالجوال في المهمّة 10، حيث يبقى صندوقُ معلّمٍ معلَّقٌ بعد الترقية.

- [ ] **الخطوة 1:** يُنفَّذ التغيير.
- [ ] **الخطوة 2:** `pnpm test && pnpm typecheck`. المتوقّع: PASS، ولا خطأ غيرُ الثلاثة المعروفة.
- [ ] **الخطوة 3:** إيداعٌ برسالة: `feat: قاعدةُ الجهاز 5 بصندوقَي الزيارات والاختبارات`

---

### المهمّة 4: صندوقُ الزيارات (أداةٌ نقيّة وتعريفُ الصندوق)

**الملفّات:**
- إنشاء: `app/utils/visitOutbox.ts`
- إنشاء: `app/utils/fieldScreens.ts` (جلبُ ما تحتاجه شاشتا المشرف والمختبِر، ويشترك فيه المكوّنُ والتسخين)
- تعديل: `app/utils/offlineQueues.ts`
- اختبار: `app/utils/visitOutbox.test.ts`، `app/utils/fieldScreens.test.ts`

**الواجهات:**
- تستهلك: `QueueEntry` من `useOfflineQueue`، و`patchSnapshot` و`SCREEN_KEYS.visits`، و`DeductionCounts` و`DeductionItem` و`groupCriteria` و`visitTotals` من `utils/visitForm.ts`، و`VisitRow` من `types/visits.ts`.
- تُنتج: من `utils/fieldScreens.ts`:
  - `export const VISIT_ITEMS_KEY = 'visit-deduction-items'`
  - `export async function fetchDeductionItems(supabase): Promise<DeductionItem[]>` — الاستعلامُ نفسه الذي في `ResultModal.vue:34` حرفياً، ويرمي الخطأ.
- تُنتج: من `utils/visitOutbox.ts`:
  - `export interface VisitEntry extends QueueEntry { visitId: string, executedAt: string, deductions: DeductionCounts, notes: string | null }`
  - `export function newVisitEntry(uid: string, visitId: string, input: { executedAt: string, deductions: DeductionCounts, notes: string | null }, now?: Date): VisitEntry` — `key = \`${uid}|${visitId}\``، و`status: 'pending'`، و`attempts: 0`، و`recordedAt = now.toISOString()`.
  - `export const VISIT_NOT_SAVED = 'لم تُحفظ الزيارة — ليست ضمن صلاحيتك أو حُذفت.'`
  - `export const VISIT_RESULT_COLUMNS` — الأعمدةُ التي يُرقَّع بها الصفّ: `'id, executed_at, locked_at, score, deductions, notes, status'`. **يتحقّق المنفّذ** من أسمائها في `database.types.ts`، ويحذف ما ليس في الجدول.
  - `export async function uploadVisitResult(supabase, e: VisitEntry): Promise<{ data: unknown, error: { code?: string, message?: string } | null }>` — `update({ executed_at, deductions, notes }).eq('id', e.visitId).select(VISIT_RESULT_COLUMNS)`. إن عاد بلا صفوف ردّ `{ data: null, error: { code: '42501', message: VISIT_NOT_SAVED } }`، وإلا ردّ `{ data: rows[0], error: null }`.
  - `export function settledVisits(rows: VisitRow[], visitId: string, patch: Partial<VisitRow>): VisitRow[]` — يدمج `patch` في الصفّ المطابق وحده.
  - `export function applyPendingVisits(rows: VisitRow[], entries: VisitEntry[], items: DeductionItem[]): VisitRow[]` — للصفوف ذات السطر المعلَّق: `executed_at` و`deductions` و`notes` من السطر، و`score = visitTotals(groupCriteria(items), e.deductions).score`، و`locked_at = e.recordedAt`، فتُعرض مقفلةً للقراءة.
- تُنتج: من `utils/offlineQueues.ts`:
  - `export const VISIT_QUEUE = 'visits'`
  - `defineOfflineQueue<VisitEntry>(VISIT_QUEUE, { store: 'visit_outbox', order: بـrecordedAt, upload: uploadVisitResult, settle })`. و`settle` = `patchSnapshot<VisitRow[]>(e.uid, SCREEN_KEYS.visits, rows => settledVisits(rows, e.visitId, data as Partial<VisitRow>))`.

- [ ] **الخطوة 1: الاختبارات الفاشلة** في `visitOutbox.test.ts`:
  - `newVisitEntry يثبّت يومَ التنفيذ ووقتَ الحفظ` — `newVisitEntry('u','v',{ executedAt: '2026-10-28T09:00:00+03:00', deductions:{a:1}, notes:null }, new Date('2026-10-28T20:59:00Z'))`، فالمتوقّع: `key === 'u|v'`، و`executedAt` كما أُعطي، و`recordedAt === '2026-10-28T20:59:00.000Z'`.
  - `uploadVisitResult يرسل يومَ التنفيذ من السطر لا من الساعة` — محاكاةُ supabase تلتقط جسمَ `update`، فيتساوى `executed_at` مع `e.executedAt`.
  - `uploadVisitResult بلا صفوفٍ رفضٌ دائم` — المحاكاةُ تردّ `{ data: [], error: null }`، فالمتوقّع: `error.code === '42501'` و`error.message === VISIT_NOT_SAVED`، و`classifySyncError(error) === 'reject'`.
  - `settledVisits يرقّع الصفَّ المطابق وحده` — صفّان، والمرقَّعُ أحدهما.
  - `applyPendingVisits تعرض الزيارةَ المحفوظة على الجهاز مقفلةً بمجموعها` — بندان (`per_time` 1 و2 في معيارٍ واحد)، والعدّ `{a:1,b:1}`، فالمتوقّع: `score === visitTotals(groupCriteria(items), {a:1,b:1}).score`، و`locked_at === e.recordedAt`، والصفُّ الآخر بلا تغيير.

  وفي `fieldScreens.test.ts`: `fetchDeductionItems يرمي خطأ supabase`.
- [ ] **الخطوة 2:** `pnpm vitest run app/utils/visitOutbox.test.ts app/utils/fieldScreens.test.ts`. المتوقّع: FAIL.
- [ ] **الخطوة 3:** يُنفَّذ ما في الواجهات.
- [ ] **الخطوة 4:** الأمرُ نفسه. المتوقّع: PASS.
- [ ] **الخطوة 5:** إيداعٌ برسالة: `feat: صندوقُ رفع تقييم الزيارة بلا اتصال`

---

### المهمّة 5: شاشةُ الزيارات تحفظ بلا اتصال

**الملفّات:**
- إنشاء: `app/composables/useVisitOffline.ts`، واختبارُه `app/composables/useVisitOffline.test.ts`
- تعديل: `app/components/visits/ResultModal.vue`
- تعديل: `app/pages/visits/index.vue`
- إنشاء (إن تجاوز `ResultModal.vue` 315 سطراً بعد التعديل): `app/components/visits/RescheduleLog.vue` — يُنقل إليه قسمُ سجلّ تغييرات الموعد وجلبُه كما هما.

**الواجهات:**
- تستهلك: `VISIT_QUEUE`، و`VisitEntry`، و`newVisitEntry`، و`applyPendingVisits`، و`VISIT_ITEMS_KEY`، و`fetchDeductionItems` (المهمّة 4)، و`offlineOwnerUid` (المهمّة 1)، و`useOfflineQueue`، و`useOfflineCopy().wrap`، و`isOnlineNow`.
- تُنتج: من `composables/useVisitOffline.ts`:
  - `export const VISIT_SAVED_ON_DEVICE = 'حُفظ التقييم على جهازك، ويُرفع حين يعود الاتصال.'`
  - `export const PENDING_UPLOAD_BADGE = 'على جهازك — بانتظار الرفع'`
  - `export function useVisitOffline()` تردّ:
    - `uid: ComputedRef<string | null>`
    - `pending: ComputedRef<VisitEntry[]>`
    - `pendingFor(visitId: string): VisitEntry | null`
    - `shouldQueue(visitId: string): boolean` — `!!uid && (!isOnlineNow() || !!pendingFor(visitId))`
    - `saveOnDevice(visitId, input): Promise<void>`
    - `rejected: ComputedRef<{ key: string, label: string, error?: string }[]>` — `label` = `زيارة <اسم الحلقة>` من نسخة القائمة إن وُجد، وإلا `زيارة`.
    - `retry`، `discard`، `lastUploaded`.

**التغييرات في المكوّنات:**
- **`ResultModal.vue`:**
  - جلبُ البنود: `useLazyAsyncData(VISIT_ITEMS_KEY, wrap(VISIT_ITEMS_KEY, () => fetchDeductionItems(supabase).catch(...)))`.
  - سجلُّ الموعد: لا يُجلب حين `!isOnlineNow()`، ويُخفى قسمُه.
  - `save()`: إن كان `shouldQueue(v.id)` فـ`saveOnDevice(v.id, { executedAt: executedAtFromDay(executedDay), deductions: cleanCounts(counts), notes })`، ثم toast بـ`VISIT_SAVED_ON_DEVICE` وأيقونة `i-lucide-cloud-upload`، ثم يُغلَق ويُصدر `saved`. وإلا فالمسارُ المتّصل كما هو.
  - زيارةٌ لها سطرٌ معلَّق: تُفتح للقراءة بعدّ السطر وملاحظاته ويومه، وتحمل الشارة `PENDING_UPLOAD_BADGE`.
- **`visits/index.vue`:**
  - الصفوف المعروضة = `applyPendingVisits(visits, pending, items)`. والبنودُ من نسخة `VISIT_ITEMS_KEY` بالـ`wrap` نفسه.
  - شارةُ `PENDING_UPLOAD_BADGE` في عمود الحالة للصفّ المعلَّق.
  - `OfflineRejectedDays` بالعنوان `لم تقبلها القاعدة` كما في الحوافز.
  - أزرارُ الجدولة والتأجيل والحذف وفتح المقفلة: `:disabled="!online"`، و`title="يحتاج اتصالاً"` حين `!online`. و`online` هو `queueOnline`.
  - `watch(lastUploaded, () => refresh())`.

- [ ] **الخطوة 1: الاختبارات الفاشلة** في `useVisitOffline.test.ts`، على نمط `useIncentiveOffline.test.ts` في المحاكاة:
  - `shouldQueue بلا اتصال للمشرف` ← `true`.
  - `shouldQueue متّصلاً بلا سطرٍ معلَّق` ← `false`.
  - `shouldQueue متّصلاً وللزيارة سطرٌ معلَّق` ← `true`، كي لا يتخطّى حفظٌ جديدٌ قديمَه.
  - `shouldQueue للمدير الفنيّ` ← `false` (لا `uid`).
  - `saveOnDevice يضع سطراً بمفتاح uid|visitId ويومِ التنفيذ المختار` — يومٌ قبل اليوم، فيبقى في السطر كما هو.
  - `pendingFor يردّ السطرَ لإعادة الفتح للقراءة`.
- [ ] **الخطوة 2:** `pnpm vitest run app/composables/useVisitOffline.test.ts`. المتوقّع: FAIL.
- [ ] **الخطوة 3:** يُنفَّذ الـcomposable، ثم المكوّنان، ثم يُحدَّث تعليقُ رأس كلٍّ منهما.
- [ ] **الخطوة 4:** `pnpm test && pnpm lint && pnpm typecheck`. المتوقّع: أخضر، ولا خطأ غيرُ الثلاثة المعروفة.
- [ ] **الخطوة 5:** إيداعٌ برسالة: `feat: تقييمُ الزيارة بلا اتصال للمشرف الميدانيّ`

---

### المهمّة 6: صندوقُ الاختبارات (أداةٌ نقيّة وتعريفُ الصندوق)

**الملفّات:**
- إنشاء: `app/utils/examOutbox.ts`
- تعديل: `app/utils/fieldScreens.ts`
- تعديل: `app/utils/offlineQueues.ts`
- اختبار: `app/utils/examOutbox.test.ts`، `app/utils/fieldScreens.test.ts`

**الواجهات:**
- تُنتج: من `utils/fieldScreens.ts`. يُنقل إليه من `GradeQueue.vue` كما هو: النوعُ `QueueRaw`، والاستعلامُ، و`QUEUE_LIMIT = 500`.
  - `export const EXAMS_QUEUE_KEY = 'exams-queue'`
  - `export type ExamQueueRaw` — هو `QueueRaw` مُصدَّراً.
  - `export async function fetchExamQueue(supabase): Promise<ExamQueueRaw[]>` — يرمي الخطأ.
  - `export const EXAMS_PASSMARK_KEY = 'exams-passmark'`
  - `export async function fetchPassMark(supabase): Promise<number | null>` — `pass_mark` من `app_settings` (id=1)، وnull إن غابت.
- تُنتج: من `utils/examOutbox.ts`:
  - `export type ExamPayload = Database['public']['Tables']['exam_results']['Insert']`
  - `export interface ExamEntry extends QueueEntry { itemId: string, studentName: string, title: string, payload: ExamPayload }`
  - `export function newExamEntry(uid: string, item: { id: string, studentName: string, title: string }, payload: ExamPayload, now?: Date): ExamEntry` — `key = \`${uid}|${item.id}\``.
  - `export const EXAM_GRADED_BY_OTHER = 'رُصدت نتيجةُ هذا الطالب قبل رفع نتيجتك.'`
  - `export async function uploadExamResult(supabase, e: ExamEntry): Promise<UploadResult>` — `insert(e.payload)`، وثلاث حالات:
    - **عند `23505`:** يقرأ `examiner_id` من `exam_results` حيث `exam_list_item_id = e.itemId` (`maybeSingle`). إن ساوى `e.uid` ردّ `{ data: null, error: null }` (ردٌّ ضائع)، وإلا ردّ `{ data: null, error: { code: '23505', message: EXAM_GRADED_BY_OTHER } }`.
    - **غيرُ ذلك من الأخطاء:** يُردّ كما هو.
    - **نجاح:** `{ data: null, error: null }`.
  - `export function examTotal(p: ExamPayload): number` — مجموعُ الخانات التسع والتجويد.
  - `export function passVerdict(total: number, passMark: number | null): 'passed' | 'failed' | null` — null إن كانت `passMark` null.
  - `export function withoutPending<T extends { id: string }>(rows: T[], entries: ExamEntry[]): T[]` — يُسقط البنودَ التي لها سطرٌ معلَّقٌ أو مرفوض.
- تُنتج: من `utils/offlineQueues.ts`:
  - `export const EXAM_QUEUE = 'exams'`
  - `defineOfflineQueue<ExamEntry>(EXAM_QUEUE, { store: 'exam_outbox', order: بـrecordedAt, upload: uploadExamResult, settle })`. و`settle` = `patchSnapshot<ExamQueueRaw[]>(e.uid, EXAMS_QUEUE_KEY, rows => rows.filter(r => r.id !== e.itemId))`.

- [ ] **الخطوة 1: الاختبارات الفاشلة** في `examOutbox.test.ts`:
  - `newExamEntry يحفظ exam_date يومَ الرصد` — حمولةٌ فيها `exam_date: '2026-10-28'`، ورفعٌ بمحاكاةٍ بعد منتصف الليل، فيصل الخادمَ `'2026-10-28'`.
  - `23505 وراصدُها صاحبُ السطر نجاحٌ (ردٌّ ضائع)` — `insert` يردّ `{ error: { code: '23505' } }`، والقراءةُ تردّ `{ data: { examiner_id: 'u' } }`، فالمتوقّع: `error === null`.
  - `23505 وراصدُها غيرُه رفض` ← `error.message === EXAM_GRADED_BY_OTHER`، و`classifySyncError(error) === 'reject'`.
  - `23503 (سُحب الترشيح) يمرّ رفضاً` ← `classifySyncError` ← `'reject'`.
  - `examTotal يجمع العشر` — تسعٌ بـ10، والتجويد 9، فالمجموع `99`.
  - `passVerdict` — `(85, 80)` ← `'passed'`، و`(79.5, 80)` ← `'failed'`، و`(99, null)` ← `null`.
  - `withoutPending يُسقط المرصودَ على الجهاز` — ثلاثةُ بنود وسطرٌ لأحدها، فيبقى اثنان.
- [ ] **الخطوة 2:** `pnpm vitest run app/utils/examOutbox.test.ts app/utils/fieldScreens.test.ts`. المتوقّع: FAIL.
- [ ] **الخطوة 3:** يُنفَّذ ما في الواجهات. و`GradeQueue.vue` يستورد `fetchExamQueue` و`ExamQueueRaw` بدل نسخته المحلّية، ولا تغييرَ في سلوكه هنا.
- [ ] **الخطوة 4:** `pnpm test && pnpm typecheck`. المتوقّع: أخضر.
- [ ] **الخطوة 5:** إيداعٌ برسالة: `feat: صندوقُ رفع نتائج الاختبار بلا اتصال`

---

### المهمّة 7: شاشةُ الاختبارات ترصد بلا اتصال

**الملفّات:**
- إنشاء: `app/composables/useExamOffline.ts`، واختبارُه `app/composables/useExamOffline.test.ts`
- إنشاء: `app/components/exams/PendingUploads.vue` — قسمُ «على جهازك»
- تعديل: `app/components/exams/GradeQueue.vue`
- تعديل: `app/components/exams/GradeModal.vue`
- تعديل: `app/pages/exams/index.vue`

**الواجهات:**
- تستهلك: من المهمّة 6 `EXAM_QUEUE`، و`ExamEntry`، و`newExamEntry`، و`examTotal`، و`passVerdict`، و`withoutPending`، و`EXAMS_QUEUE_KEY`، و`fetchExamQueue`، و`EXAMS_PASSMARK_KEY`، و`fetchPassMark`. ومن المهمّة 5 `PENDING_UPLOAD_BADGE`. ومن المهمّة 1 `offlineOwnerUid`.
- تُنتج: من `composables/useExamOffline.ts`:
  - `export const EXAM_SAVED_ON_DEVICE = 'حُفظت النتيجة على جهازك، وتُرفع حين يعود الاتصال.'`
  - `export function useExamOffline(passMark: Ref<number | null>)` تردّ:
    - `uid`
    - `pending: ComputedRef<{ key, studentName, title, total: number, verdict: 'passed' | 'failed' | null }[]>`
    - `entries`
    - `shouldQueue(): boolean` — `!!uid && !isOnlineNow()`
    - `saveOnDevice(item: { id, studentName, title }, payload: ExamPayload): Promise<void>`
    - `rejected: ComputedRef<{ key, label, error? }[]>` — `label` = اسمُ الطالب
    - `retry`، `discard`، `lastUploaded`
- `ExamsPendingUploads` props: `{ items: { key: string, studentName: string, title: string, total: number, verdict: 'passed' | 'failed' | null }[] }`. عنوانُه `PENDING_UPLOAD_BADGE`، ولكلّ طالبٍ اسمُه وعنوانُ دورته و`<total> / 99`، وشارةُ «اجتاز» أو «لم يجتز» إن لم يكن الحكمُ null.

**التغييرات في المكوّنات:**
- **`GradeQueue.vue`:**
  - الجلب: `useLazyAsyncData(EXAMS_QUEUE_KEY, wrap(EXAMS_QUEUE_KEY, async () => { void quran.load(); return fetchExamQueue(supabase) … }))`.
  - الصفوف: `withoutPending(rows, entries)`.
  - فوق الطابور: `ExamsPendingUploads`، ثم `OfflineRejectedDays`.
  - زرُّ سحب الترشيح: معطّلٌ بلا اتصال بتلميح `يحتاج اتصالاً`.
  - `watch(lastUploaded, () => refresh())`.
- **`GradeModal.vue`:**
  - درجةُ النجاح: `wrap(EXAMS_PASSMARK_KEY, () => fetchPassMark(supabase))` بلا افتراضٍ في العرض. أمّا الحمولة فتُبقي `?? 80` لأنّ القاعدة تستبدلها.
  - `grade()`: إن كان `shouldQueue()` فـ`saveOnDevice(...)` بالحمولة نفسها (و`exam_date: gazaToday()` ساعةَ الحفظ)، ثم toast بـ`EXAM_SAVED_ON_DEVICE`، ثم يُغلق ويُصدر `saved`. وإلا فكما هو.
- **`exams/index.vue`:** حين `!queueOnline` يحلّ محلّ `ExamsResultsBrowser` سطرٌ هادئ: `النتائج السابقة تحتاج اتصالاً.`

- [ ] **الخطوة 1: الاختبارات الفاشلة** في `useExamOffline.test.ts`:
  - `saveOnDevice يضع سطراً بمفتاح uid|itemId وexam_date يومَ الحفظ`.
  - `pending تحسب المجموعَ والحكم` — درجةُ نجاحٍ 80 ومجموعٌ 85 ← `'passed'`.
  - `بلا درجة نجاحٍ محفوظة لا حكم` — `passMark = ref(null)` ← `verdict === null`.
  - `shouldQueue متّصلاً` ← `false`، و`shouldQueue بلا uid` ← `false`.
  - `rejected تحمل اسمَ الطالب ورسالةَ القاعدة`.
- [ ] **الخطوة 2:** `pnpm vitest run app/composables/useExamOffline.test.ts`. المتوقّع: FAIL.
- [ ] **الخطوة 3:** يُنفَّذ الـcomposable، ثم المكوّنُ الجديد، ثم التعديلات، ثم تعليقاتُ الرؤوس.
- [ ] **الخطوة 4:** `pnpm test && pnpm lint && pnpm typecheck`. المتوقّع: أخضر.
- [ ] **الخطوة 5:** إيداعٌ برسالة: `feat: رصدُ نتائج الاختبار بلا اتصال للمختبِر`

---

### المهمّة 8: التسخين من اللوحة، وعلامةُ صاحب الجهاز

**الملفّات:**
- إنشاء: `app/composables/useWarmFieldCopies.ts`، واختبارُه `app/composables/useWarmFieldCopies.test.ts`
- تعديل: `app/utils/offlineCache.ts` — مفتاحٌ جديد `WARMED_FIELD_CACHE_KEY = 'torjoman-offline-warmed-field'` بجوار `WARMED_SCREENS_CACHE_KEY`، ويُضاف إلى قائمة المحو عند الخروج (السطر 35).
- تعديل: `app/pages/dashboard.vue` — `onMounted(() => void warmField())`.

**الواجهات:**
- تستهلك: `offlineOwnerRole` و`offlineOwnerUid` (المهمّة 1)، و`warmDue` المصدَّرة من `useWarmTeacherMirrors.ts`، و`writeSnapshot`، و`SCREEN_KEYS.visits`، و`SCREEN_KEYS.visitHalqat`، و`fetchVisits`، و`fetchVisitHalqat`، و`VISIT_ITEMS_KEY` و`fetchDeductionItems` (المهمّة 4)، و`EXAMS_QUEUE_KEY` و`fetchExamQueue` و`EXAMS_PASSMARK_KEY` و`fetchPassMark` (المهمّة 6)، و`useQuranReference().load`، و`idbPut`.
- تُنتج:
  - `export function useWarmFieldCopies(): { warm: () => Promise<void> }`
  - سلوكُ `warm`:
    1. لا يفعل شيئاً بلا اتصال، أو لغير المشرف والمختبِر، أو بلا `uid`، أو قبل مرور ساعة (`warmDue(last, uid, Date.now())` بالمهلة الافتراضية 60 دقيقة، والوقتُ في `WARMED_FIELD_CACHE_KEY`).
    2. يكتب `idbPut('meta', uid, 'current')`.
    3. **للمشرف**، متتابعاً: الزيارات، وحلقاتُها، والبنود.
    4. **للمختبِر**: الطابور، ودرجةُ النجاح، ثم `quran.load()`.
    5. يكتب الوقت.

    والفشلُ صامتٌ لكلّ نسخة.

- [ ] **الخطوة 1: الاختبارات الفاشلة** في `useWarmFieldCopies.test.ts`، على نمط `useWarmTeacherMirrors.test.ts`:
  - `المشرف يحفظ نسخَ الزيارات والحلقات والبنود ويعلّم الجهاز` — ثلاثُ مفاتيح `snap|u|…`، و`meta.current === 'u'`.
  - `المختبِر يحفظ الطابور ودرجة النجاح ومرجع المصحف` — مفتاحان، و`load` نُودي.
  - `المدير الإداري لا يُحفظ له شيء`.
  - `لا يُعاد قبل ساعة`.
  - `فشلُ نسخةٍ لا يوقف ما بعدها`.
- [ ] **الخطوة 2:** `pnpm vitest run app/composables/useWarmFieldCopies.test.ts`. المتوقّع: FAIL.
- [ ] **الخطوة 3:** يُنفَّذ الـcomposable، ويُربط في `dashboard.vue`.
- [ ] **الخطوة 4:** `pnpm test && pnpm lint && pnpm typecheck`. المتوقّع: أخضر.
- [ ] **الخطوة 5:** إيداعٌ برسالة: `feat: نسخُ المشرف والمختبِر تُحفظ من اللوحة كلَّ ساعة`

---

### المهمّة 9: التوثيق

**الملفّات:**
- تعديل: `docs/FEATURES.md`: بندٌ في سجلّ التغييرات بتاريخ 2026-10-29 يصف ما بُني والقرارات الستّة من التصميم.
- تعديل: `docs/PAGES.md`: شاشتا `/visits` و`/exams` «تعمل بلا اتصال للمشرف والمختبِر».
- تعديل: `docs/ROADMAP.md`: البند 14، المشرف والمختبِر منجزان.

- [ ] **الخطوة 1:** يُحدَّث الثلاثة.
- [ ] **الخطوة 2:** إيداعٌ برسالة: `docs: المشرف والمختبِر بلا إنترنت`

---

### المهمّة 10 (للمنسِّق، لا للمنفِّذ): التجربة على الجوال

- [ ] **إذنُ المستخدم أوّلاً** لإنشاء بياناتٍ تجريبية في الإنتاج على «حلقة تجريبية» `14bc242d-18fb-401f-8703-19128ada73c5`: حسابُ مشرفٍ ميدانيّ وحسابُ مختبِر مُسندان إليها، وزيارةٌ مجدولة لليوم، وترشيحٌ لـ«طالب تجريبي» `ad9819f8-c4f7-4cb5-8e7b-833fb09d34f2`.
- [ ] بناءُ نسخة التحقّق (`scratchpad/build`)، ثم الجوال عبر adb.
- [ ] **سيناريو المشرف:**
  1. يدخل متّصلاً ويفتح لوحته.
  2. يقطع الاتصال، ويعيد فتح التطبيق، فيُقلع على `/visits`.
  3. يقيّم الزيارة ويحفظ، فتظهر الشارة.
  4. يعيد فتح الزيارة، فيراها للقراءة.
  5. يُعاد الاتصال، فترتفع الزيارة. ويُتحقَّق في القاعدة من `executed_at` و`score` و`locked_at`، ومن إشعار المعلّم.
- [ ] **سيناريو المختبِر:** كالمشرف على `/exams`، ثم يُتحقَّق من `exam_date` ومن رفع الأجزاء.
- [ ] **سيناريو المعلّم:** بلا اتصال، يتحقّق أنّ لوحته وحضوره وإنجازه تعمل كما كانت.
- [ ] حذفُ البيانات التجريبية، وإبقاءُ الحلقة والطالب التجريبيَّين كما طلب المستخدم.
