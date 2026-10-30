# «لم تنعقد الحلقة» والإجازات العامة — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**الهدف:**
- المعلّمُ يبلّغ، ولو بلا إنترنت، أنّ حلقته لم تنعقد يوماً ما بسببه، فيعتمد البلاغَ المشرفُ أو المديرون.
- والمديرُ الإداري يعيّن إجازاتٍ عامة.
- واليومُ المعتمَد أو المجاز لا يُعدّ ناقصاً.

**البنية:**
- **القاعدة:** جدولان جديدان (`attendance_off_days` و`attendance_holidays`)، ودوالُّ `definer` للبلاغ والسحب والاعتماد، وحارسٌ على
  `attendance_days` يفرض أنّ اليوم الواحد حضورٌ أو بلاغ، ولا حضورَ في الإجازة.
- **صفحة المعلّم بلا إنترنت:** صندوقُ الحضور القائم يحمل نوعَ السطر (`attendance` · `off` · `withdraw`)، فاليومُ سطرٌ واحد والأحدثُ يغلب.
  ونسخةُ الجهاز تحمل البلاغاتِ والإجازات.
- **الشاشاتُ المتّصلة** تقرأ الجدولين مباشرةً.

**التقنية:** Nuxt 4 · @nuxt/ui v4 · Supabase (Postgres 15، RLS) · IndexedDB عبر `useOfflineQueue` · Vitest.

**التصميم:** `docs/superpowers/specs/2026-10-30-halaqa-off-day-design.md`. **اقرأه قبل أيّ مهمّة**؛ هو المرجع عند التعارض.

## القيود العامّة

**اللغة والشكل:**
- كلُّ نصٍّ يراه المستخدم عربيّ. الاتجاه RTL، وأهدافُ اللمس ≥ 44px، والأشهرُ بالأرقام لا بالأسماء.
- لا ألوانَ مباشرة؛ متغيّراتُ CSS من `app/assets/css/main.css` وحدَها، مثل `--green-soft` و`--chip-warn-ink` و`--blue-soft` و`--surface-2`.
- الوضعان الفاتح والليلي.

**الكود:**
- كلُّ ملفٍّ ≤ 300 سطر، وفي رأسه JSDoc بالعربية يشرح غرضَه.
- لا `any`، ولكلّ composable جديدٍ ملفُّ `*.test.ts`. منطقُ الأعمال في `app/utils` أو composables، لا في المكوّنات.
- **أنواعُ القاعدة تُولَّد فقط** (`app/types/database.types.ts`)، ولا تُكتب يدوياً.
- عدّل الملفّات بأداتي Edit/Write، لا بسكربتات الصَّدفة (`sed -i`، `cat >`).
- لا تمسّ المجلّد `/Users/aboomar/Developer/torjoman`؛ العملُ في `/Users/aboomar/Developer/torjoman-v2b2` وحدَه.
- لا `git push`، ولا تطبيقَ هجرةٍ على الإنتاج. ذلك للمتحكّم بعد إذن المستخدم.

**القاعدة:**
- كلُّ دالّةٍ في سياسة أو دالّةٍ كاتبة: `set search_path = ''`، وسحبُ PUBLIC و`anon`، ثمّ `grant execute … to authenticated` صراحةً.
  ودوالُّ المشغّلات بلا `EXECUTE` لأحد.
- كلُّ دالّةٍ `definer` كاتبة تبدأ بـ`perform private.assert_session_writable();`.
- القراءةُ المحميّة بالحلقة بنمط `(halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))`.

**الأسماءُ الثابتة:**
- **قيمُ السبب:** `official_holiday` · `security` · `teacher_sick` · `other`. وتسمياتُها: «عطلة رسمية» · «ظرف أمني» · «مرض المعلم
  أو عذر طارئ» · «سبب آخر».
- **قيمُ الحالة:** `pending` · `approved` · `rejected`.
- **أنواعُ الإشعار الجديدة**، بهذا الترتيب بعد `student_request_closed`، تنسيقاً مع جلسةٍ أخرى تبني «خطة القسم»:
  1. `off_day_reported`
  2. `off_day_rejected`
  3. `plan_task_assigned`
  4. `plan_task_due`
  5. `plan_task_overdue`
  6. `plan_weekly_update`

## محاور المراجعة

1. **سطرٌ في صندوق الحضور حُفظ قبل التحديث** (بلا حقل `kind`): يُرفع حضوراً كما كان، ولا يُفقد. اختبارُه في المهمّة 2.
2. **نسخةُ جهازٍ قديمة** بلا `offDays` و`holidays`: الشاشةُ تعمل كأنّ لا بلاغات ولا إجازات. اختبارُه في المهمّتين 2 و3.
3. **بلاغٌ بلا اتصال ثمّ «حفظ الحضور» بلا اتصال لليوم نفسه:** سطرٌ واحد هو الحضور، والقاعدةُ تمحو بلاغاً معلّقاً سبق رفعُه.
   اختبارُه في المهمّة 2 (الصندوق) والتجربةُ الجافّة في المهمّة 1 (القاعدة).
4. **يومٌ صار إجازةً أو اعتُمد بلاغُه بعد آخر تحديثٍ للنسخة، فسُجّل حضورُه بلا اتصال:** القاعدةُ ترفض برسالةٍ عربية، ويظهر الرفضُ في
   «أيامٌ لم تقبلها الإدارة» مع إعادةٍ أو ترك. اختبارُه في المهمّة 2: `rejectionText` يعرض الرسالةَ العربية كما هي.
5. **المدير الفنيّ على حلقة بنات، أو المديرة الإدارية على حلقة بنين:** لا يعتمد، ولا يصله إشعار. التجربةُ الجافّة في المهمّة 1.

---

### المهمّة 1: الهجرة — الجدولان والدوالّ والحرّاس ومتابعة الرصد

**الملفّات:**
- إنشاء: `supabase/migrations/20261030120000_attendance_off_days.sql`. رقمُه مؤقّت، ويُعاد تسميتُه برقم الإنتاج الفعليّ بعد التطبيق.

**الواجهات التي تنتجها** (تعتمد عليها المهامّ التالية بعد توليد الأنواع):

**جدول `public.attendance_off_days`:**
- **الأعمدة:**
  - `id uuid pk default gen_random_uuid()`
  - `halaqa_id uuid not null references public.halaqat on delete cascade`
  - `day date not null`، و`unique (halaqa_id, day)`
  - `reason text not null check (reason in ('official_holiday','security','teacher_sick','other'))`
  - `note text`، و`check (char_length(note) <= 300)`
  - `check (reason <> 'other' or btrim(coalesce(note,'')) <> '')`
  - `status text not null default 'pending' check (status in ('pending','approved','rejected'))`
  - `reported_by uuid references public.profiles`
  - `reported_at timestamptz not null default now()`
  - `reviewed_by uuid references public.profiles`، `reviewed_at timestamptz`
  - `review_note text check (char_length(review_note) <= 300)`
  - `created_at timestamptz not null default now()`، `updated_at timestamptz not null default now()`
  - فهرسٌ على `(status, day)`.
- **RLS:** مفعّلة. سياسةُ قراءةٍ واحدة لـ`authenticated` بنمط `visible_halaqa_ids()`. **لا سياساتِ كتابة**، فالكتابةُ عبر الدوالّ وحدها.
- **النيابة:** `select private.guard_table_for_impersonation('public.attendance_off_days');`.

**جدول `public.attendance_holidays`:**
- **الأعمدة:** `day date pk` · `reason text not null check (btrim(reason) <> '' and char_length(reason) <= 80)` ·
  `created_by uuid references public.profiles default auth.uid()` · `created_at timestamptz not null default now()`.
- **RLS:**
  - قراءةٌ لكلّ `authenticated`.
  - إدراجٌ وحذفٌ حين `public.current_user_role() = 'admin_manager'` (تحقّق من اسم دالّة الدور في الإنتاج).
  - لا تعديل.
- **الحارس:** مشغّلٌ يرفض الجمعة (`isodow = 5`) وما قبل 2026-10-01 برسائلَ عربية.
- **النيابة:** حارسُها كالجدول الأوّل.

**الدوالّ:**

`private.can_review_off_day(p_halaqa uuid) returns boolean` (definer، stable) — تصدق إن كان المستدعي واحداً من:
- مشرفَ الحلقة (`halaqat.supervisor_id`)؛
- أو `admin_manager`؛
- أو `technical_manager` والحلقةُ `gender = 'male'`؛
- أو `women_admin` والحلقةُ `gender = 'female'`.

`private.off_day_window_ok(p_halaqa uuid, p_day date) returns text` — تردّ نصَّ الرفض العربيّ أو `null`. تُستعمل في البلاغ وحده، وترفض:

| الحالة | النصّ |
|---|---|
| الجمعة | «الجمعة عطلة — لا بلاغ فيها» |
| ما قبل 2026-10-01 | «قبل بداية المشروع» |
| يومٌ لم يأتِ (`> private.attendance_today()`) | «لا بلاغ عن يومٍ لم يأتِ» |
| يومٌ قبل أوّل الشهر السابق، أي `date_trunc('month', today) - interval '1 month'` | «البلاغُ لأيام هذا الشهر والذي قبله» |
| `private.attendance_month_approved(p_halaqa, p_day)` | «الشهر معتمَد — لا بلاغ بعد اعتماده» |
| يومٌ في `attendance_holidays` | «هذا اليوم إجازةٌ عامة — لا يحتاج بلاغاً» |

`public.report_off_day(p_halaqa uuid, p_day date, p_reason text, p_note text, p_reported_at timestamptz default null) returns jsonb`
(definer):
- **الترتيب:** `assert_session_writable` ← المستدعي معلّمُ الحلقة الحاليّ (`halaqat.teacher_id = auth.uid()`، وإلا `42501`) ←
  `off_day_window_ok` (`P0001` بالنصّ) ← بلاغٌ `approved` قائمٌ يُرفض بنصّ «اعتُمد البلاغُ عن هذا اليوم».
- **حذفُ حضور اليوم:** `delete from attendance_days where halaqa_id = p_halaqa and day = p_day`، فتتبعه الغياباتُ تتابعاً.
- **الكتابة:** `insert … on conflict (halaqa_id, day) do update` يضبط السببَ والملاحظةَ (`nullif(btrim(p_note),'')`) و`status = 'pending'`
  و`reported_by` و`reported_at = least(coalesce(p_reported_at, now()), now())`، ويمسح `reviewed_*` و`review_note`.
- **الإشعار** بنوع `off_day_reported`، يصل إلى:
  - مشرفِ الحلقة؛
  - ثمّ المدير الفنيّ النشط إن كانت الحلقةُ للبنين، أو كلِّ `women_admin` نشطة إن كانت للبنات.
  - **العنوان:** «لم تنعقد حلقة <الاسم> يوم <dd/mm>». **النصّ:** تسميةُ السبب + الملاحظة.
  - **الرابط:** `/attendance?h=<id>&d=<YYYY-MM-DD>`. **المصدر:** `('attendance_off_days', id)`.
- **الردّ:** `jsonb_build_object('id', id, 'status', 'pending')`.

`public.withdraw_off_day(p_halaqa uuid, p_day date) returns jsonb` (definer):
- `assert_session_writable` ← المستدعي معلّمُ الحلقة الحاليّ.
- **الحذف:** بلاغٌ `pending` أو `rejected` يُحذف. والمعتمَدُ يُرفض بنصّ «اعتُمد البلاغ — لا يُسحب».
- **لا صفّ = نجاحٌ صامت.** الردّ: `{"withdrawn": true|false}`.

`public.review_off_day(p_id uuid, p_approve boolean, p_note text default null) returns jsonb` (definer):
- `assert_session_writable` ← `can_review_off_day(halaqa)`، وإلا `42501`.
- **شهرٌ معتمَد للحلقة:** يُقبل فيه البلاغُ `pending` وحده، ويُرفض تغييرُ قرارٍ سابق بنصّ «الشهر معتمَد — لا يُغيَّر قرارٌ سابق».
- **الكتابة:** يضبط `status` و`reviewed_by` و`reviewed_at = now()`، و`review_note = nullif(btrim(p_note),'')` عند الرفض وحده.
- **عند الرفض** إشعارٌ للمعلّم الحاليّ بنوع `off_day_rejected`:
  - **العنوان:** «لم يُعتمد بلاغُ <dd/mm>». **النصّ:** سببُ الرفض إن وُجد.
  - **الرابط:** `/t`.
- **الردّ:** `{"status": …}`.

**التعديلات على القائم:**
- **`private.guard_attendance_days()`:** تعديلُه بعد قراءة نسخة الإنتاج الحيّة (`pg_get_functiondef`)، لا ملفّ الهجرة. يُضاف في فرع
  `INSERT` وحده، بعد الفحوص القائمة:
  - يومٌ في `attendance_holidays` يُرفض بنصّ «هذا اليوم إجازةٌ عامة: <السبب> — لا يُسجَّل فيه حضور».
  - بلاغٌ `approved` لليوم يُرفض بنصّ «اعتُمد أنّ الحلقة لم تنعقد في هذا اليوم — يُلغيه المعتمِد أوّلاً».
  - بلاغٌ `pending` أو `rejected` يُحذف.
  - **غيرُ ذلك فيها لا يُمسّ.** والحذفُ يمرّ لأنّها `definer`.
- **`save_attendance_day`:** لا تتغيّر. الحارسُ يكفيها.
- **`private.notify(...)` وقيدُ `notifications_kind_check`:** يُعاد تعريفُهما من نسخة الإنتاج الحيّة، مع الأنواع الستّة الجديدة
  بالترتيب في «القيود العامّة». وقائمةُ القيد تُكتب بصيغة `alter table public.notifications drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (…))`، لأنّ اختبار `app/constants/notifications.test.ts` يقرؤها بهذه الصيغة.
- **`public.halaqat_recording_status(integer, integer)`:** يُستبدل من نسخة الإنتاج الحيّة، بالتوقيع وأعمدة الردّ نفسها.
  - **في `days` و`recent15`:** لكلّ يوم `holiday` (في `attendance_holidays`) و`off_status` (من `attendance_off_days`).
  - **في العدّ:**
    - `expected_days` و`missed_days` تُسقطان اليومَ إن كان `holiday`، أو بلاغُه `approved`، **إلا أن يكون منعقداً**.
    - البلاغُ `pending` يبقى في `missed_days`.
  - **حالةُ اليوم في `recent`** بالأسبقية: `before` ← `held` ← `holiday` ← `off` (معتمَد) ← `off_pending` ← `today` ← `missed`.

**الخطوات:**

- [ ] **الخطوة 1: اقرأ نسخَ الإنتاج الحيّة** بـ`execute_sql` على المشروع `qwtqfkayupzijcoguqrf`، للقراءة وحدها: `pg_get_functiondef` لـ
  `private.guard_attendance_days()` و`private.notify(...)` و`public.halaqat_recording_status(integer,integer)`؛ و`pg_get_constraintdef`
  لقيد `notifications_kind_check`؛ وأسماءَ دوالّ الدور والنطاق المستعملة (`current_user_role`، `visible_halaqa_ids`،
  `attendance_today`، `attendance_month_approved`)؛ وعمودَ حالة الحساب في `profiles`. **لا تكتب شيئاً على الإنتاج.**
- [ ] **الخطوة 2: اكتب الهجرة** كما وُصفت أعلاه. وفي آخرها كتلةُ `do $$ … $$` تفحص ذاتياً:
  - الدوالُّ الأربع العامّة لـ`authenticated` وحده؛
  - `guard_attendance_days` يذكر `attendance_holidays`؛
  - المُشغِّلات فعّالة؛
  - الجدولان بـRLS مفعّلة.

  وتُرفع استثناءً إن فشل شيءٌ من ذلك.
- [ ] **الخطوة 3: أضف الأنواع الستّة** إلى `app/constants/notifications.ts` بالترتيب، ومعها أيقوناتُها:

  | النوع | الأيقونة |
  |---|---|
  | `off_day_reported` | `i-lucide-calendar-x` |
  | `off_day_rejected` | `i-lucide-calendar-x-2` |
  | `plan_task_assigned` | `i-lucide-clipboard-plus` |
  | `plan_task_due` | `i-lucide-alarm-clock` |
  | `plan_task_overdue` | `i-lucide-clock-alert` |
  | `plan_weekly_update` | `i-lucide-list-checks` |

  هذه أيقوناتُ جلسة «خطة القسم» كما أرسلتها؛ فالملفّان يجب أن يتطابقا عند الدمج. **وإن كانت هجرتُها
  (`20261030090000_department_plan`) قد طُبّقت قبل هذه، فهذه تُبنى على نسخة الإنتاج التي فيها أنواعُها.**

  ثمّ شغّل `npx vitest run app/constants/notifications.test.ts`. المتوقّع: PASS.
- [ ] **الخطوة 4:** أودِع `feat(db): «لم تنعقد الحلقة» والإجازاتُ العامة — الجدولان والدوالّ والحرّاس`.

**التحقّق** يجريه المتحكّم بعد المهمّة، لا المنفّذ:
- تجربةٌ جافّة في معاملةٍ تُلغى (`begin; … rollback;`) لكلّ صفٍّ في «التحقّق» من التصميم.
- ثمّ إذنُ المستخدم.
- ثمّ التطبيق، ففحصُ المنح، فتوليدُ الأنواع (`npm run db:types`)، فتحديثُ `docs/DATABASE.md`.

**المهامّ 2 إلى 8 لا تبدأ قبل وجود الأنواع المولَّدة.**

---

### المهمّة 2: المنطقُ النقيّ — الأسباب، والصندوق بأنواعه، والشريط

**الملفّات:**
- إنشاء: `app/utils/offDays.ts` و`app/utils/offDays.test.ts`
- تعديل: `app/utils/attendanceOutbox.ts` و`app/utils/attendanceOutbox.test.ts`
- تعديل: `app/utils/attendanceStrip.ts` واختبارُه

**الواجهات التي تنتجها:**
```ts
// offDays.ts
export const OFF_REASONS = ['official_holiday', 'security', 'teacher_sick', 'other'] as const
export type OffReason = typeof OFF_REASONS[number]
export const OFF_REASON_LABELS: Record<OffReason, string>   // التسمياتُ في «القيود العامّة»
export type OffStatus = 'pending' | 'approved' | 'rejected'
export interface OffDay { reason: OffReason, note: string | null, status: OffStatus, reviewNote: string | null }
export interface ShownOff extends OffDay { queued: boolean }          // queued = على الجهاز لم يُرفع
export const OFF_NOTE_MAX = 300
export function offInputError(reason: OffReason | null, note: string): string | null
export function offDayBlock(day: string, today: string, approvedMonths: string[], holidays: Record<string, string>): string | null
export function offStatusLabel(o: ShownOff): string
// attendanceOutbox.ts
export type OutboxKind = 'attendance' | 'off' | 'withdraw'
// OutboxEntry يُضاف إليه: kind?: OutboxKind (الغائبُ = attendance) و off?: { reason: OffReason, note: string | null }
export function entryKind(e: OutboxEntry): OutboxKind
export function newOffEntry(uid: string, halaqaId: string, day: string, reason: OffReason, note: string | null, now?: Date): OutboxEntry
export function newWithdrawEntry(uid: string, halaqaId: string, day: string, now?: Date): OutboxEntry
export function effectiveDay(mirror: MirrorDay | undefined, entry: OutboxEntry | undefined, off?: OffDay):
  MirrorDay & { pending: boolean, off: ShownOff | null }
// attendanceStrip.ts
export type StripState = 'recorded' | 'queued' | 'missing' | 'locked' | 'holiday' | 'off' | 'off_pending'
// attendanceStrip(input) يُضاف إلى مدخله: offDays: Record<string, OffDay>, holidays: Record<string, string>,
//   queuedOff: Set<string>, queuedWithdraw: Set<string>   (و queued يبقى لسطور الحضور وحدها)
```

**ما تعيده الدوالّ:**
- **`offInputError`:**
  - بلا سبب: «اختر سبباً».
  - `other` بملاحظةٍ فارغةٍ بعد التشذيب: «اكتب السببَ في الملاحظة».
  - ملاحظةٌ أطولُ من 300: «الملاحظة أطول من 300 حرف».
  - وإلا `null`.
- **`offDayBlock`:** النصوصُ نفسُها في جدول `off_day_window_ok` في المهمّة 1، ما عدا «الشهر معتمَد…» ويقابلها هنا `approvedMonths`
  بصيغة `YYYY-MM`. والإجازةُ تُقرأ من `holidays[day]`.
- **`offStatusLabel`:**

  | الحالة | النصّ |
  |---|---|
  | `queued` | «على جهازك — بانتظار الرفع» |
  | `pending` | «بانتظار الاعتماد» |
  | `approved` | «معتمَد» |
  | `rejected` | «مرفوض» |

**قواعدُ `effectiveDay`:**

| السطر | الناتج |
|---|---|
| حضور (أو بلا `kind`) | `{ held: true, absences, pending: true, off: null }` |
| `off` | `{ held: false, absences: {}, pending: true, off: { ...entry.off, status: 'pending', reviewNote: null, queued: true } }` |
| `withdraw` | `{ held: false, absences: {}, pending: true, off: null }` |
| لا سطر | النسخةُ كما هي، و`off = off ? { ...off, queued: false } : null` |

**أسبقيّةُ حالة يومٍ في الشريط:**
1. `queuedOff` ← `off_pending`.
2. `queued` ← `queued`.
3. `queuedWithdraw` ← `holiday` إن كان إجازةً، وإلا `missing`.
4. النسخةُ مسجَّلة ← `recorded`.
5. إجازة ← `holiday`.
6. بلاغٌ معتمَد ← `off`.
7. بلاغٌ معلّق ← `off_pending`.
8. شهرٌ معتمَد ← `locked`.
9. وإلا ← `missing`.

**`missing`** في الردّ = عددُ `missing` + `off_pending`.

- [ ] **الخطوة 1: اكتب الاختبارات الفاشلة**، ومنها:
  - `entryKind({ ...قديمٌ بلا kind })` = `'attendance'`. **محور المراجعة 1.**
  - `effectiveDay` في الحالات الأربع أعلاه.
  - `effectiveDay(undefined, undefined, undefined).off` = `null`. **محور المراجعة 2.**
  - `offInputError('other', '  ')` = «اكتب السببَ في الملاحظة»، و`offInputError('security', '')` = `null`.
  - **`offDayBlock` مع اليوم `today = '2026-11-01'`:**
    - `'2026-10-31'` ← `null` (الشهرُ السابق مفتوح).
    - `'2026-09-30'` ← «قبل بداية المشروع».
    - `'2026-10-30'` الجمعة ← «الجمعة عطلة — لا بلاغ فيها».
    - `'2026-11-02'` ← «لا بلاغ عن يومٍ لم يأتِ».
    - `'2026-10-31'` مع `approvedMonths = ['2026-10']` ← «الشهر معتمَد — لا بلاغ بعد اعتماده».
    - `'2026-10-29'` مع `holidays = { '2026-10-29': 'عيد' }` ← «هذا اليوم إجازةٌ عامة — لا يحتاج بلاغاً».
  - **`offDayBlock` مع اليوم `today = '2026-12-02'`:** `'2026-10-31'` ← «البلاغُ لأيام هذا الشهر والذي قبله».
  - **الشريط:** كلُّ حالةٍ من الحالات التسع، وعددُ `missing` يشمل `off_pending` ولا يشمل `off` ولا `holiday`.
  - **`rejectionText`:** `rejectionText('هذا اليوم إجازةٌ عامة: عيد — لا يُسجَّل فيه حضور')` يردّ النصَّ نفسه. **محور المراجعة 4.**
- [ ] **الخطوة 2:** `npx vitest run app/utils/offDays.test.ts app/utils/attendanceOutbox.test.ts app/utils/attendanceStrip.test.ts`.
  المتوقّع: FAIL.
- [ ] **الخطوة 3:** نفّذ الدوالّ. وتبقى `newEntry` القائمةُ تنتج `kind: 'attendance'`.
- [ ] **الخطوة 4:** الأمرُ نفسه. المتوقّع: PASS.
- [ ] **الخطوة 5:** أودِع `feat: منطقُ بلاغ «لم تنعقد» والإجازات في الصندوق والشريط`.

---

### المهمّة 3: الرفعُ ونسخةُ الجهاز

**الملفّات:**
- تعديل: `app/utils/offlineQueues.ts`، و`app/composables/useOfflineMirror.ts` واختبارُه.

**الواجهات:**
- **تستهلك:** أنواعَ المهمّة 2، والدوالَّ الثلاث من المهمّة 1 (`report_off_day` · `withdraw_off_day`)، والجدولين.
- **تنتج:**
  - في `AttendanceMirror`:
    - `offDays?: Record<string, OffDay>`
    - `holidays?: Record<string, string>`
  - `export function buildOffDays(rows: { day: string, reason: string, note: string | null, status: string, review_note: string | null }[]): Record<string, OffDay>`

**الخطوات:**
- [ ] **الخطوة 1: الاختبار.** `buildOffDays` يحوّل الصفوف، ويُسقط سبباً أو حالةً غير معروفين.
- [ ] **الخطوة 2: `refresh`.** يقرأ:
  - `attendance_off_days` للحلقة منذ `from`؛
  - و`attendance_holidays` منذ `from` بلا حدٍّ أعلى.

  ويحفظهما في النسخة. و`loadDay` يقرأ بلاغَ اليوم وإجازتَه كذلك.
- [ ] **الخطوة 3: الرفعُ في `ATTENDANCE_QUEUE`** بحسب `entryKind(e)`:

  | النوع | الرفع |
  |---|---|
  | `attendance` | كما هو |
  | `off` | `rpc('report_off_day', { p_halaqa, p_day, p_reason, p_note, p_reported_at: e.recordedAt })` |
  | `withdraw` | `rpc('withdraw_off_day', { p_halaqa, p_day })` |

- [ ] **الخطوة 4: `settle`** يحدّث النسخة:

  | النوع | التحديث |
  |---|---|
  | `attendance` | كما هو، ويحذف `offDays[day]` |
  | `off` | يضع `offDays[day] = { …, status: 'pending', reviewNote: null }`، ويحذف `days[day]` |
  | `withdraw` | يحذف `offDays[day]` |

- [ ] **الخطوة 5:** `npx vitest run app/composables/useOfflineMirror.test.ts app/composables/useOfflineQueue.test.ts`. المتوقّع: PASS.
- [ ] **الخطوة 6:** أودِع `feat: رفعُ بلاغ «لم تنعقد» وسحبِه، ونسخةُ الجهاز تحمل البلاغاتِ والإجازات`.

---

### المهمّة 4: شاشةُ المعلّم `/t`

**الملفّات:**
- إنشاء:
  - `app/components/attendance/OffDayModal.vue`: السببُ أربعةُ خياراتٍ كبيرة، والملاحظة، و«تأكيد». ومع `held` تنبيهٌ «سيُمحى حضورُ هذا
    اليوم المسجَّل».
  - `app/components/attendance/OffDayBanner.vue`: «لم تنعقد الحلقة يوم dd/mm — <السبب> · <الحالة>»، وسببُ الرفض إن وُجد. وفيه
    الأزرار المذكورة في التصميم.
  - `app/components/attendance/HolidayBanner.vue`: «إجازة — <السبب>».
- تعديل:
  - `app/composables/useOfflineAttendance.ts` واختبارُه.
  - `app/pages/t/index.vue`.
  - `app/components/attendance/WindowStrip.vue`: الحالاتُ الثلاث الجديدة وتسمياتُها ومفتاحُها.
  - `app/components/OfflineRejectedDays` أو مكانُ إنشاء الوسوم في الصفحة: سطرُ البلاغ وسمُه «بلاغ dd/mm».

**الواجهات:**
- **تستهلك:** المهمّتين 2 و3.
- **تنتج في `useOfflineAttendance()`:**
  - `holiday: ComputedRef<string | null>`
  - `off: ComputedRef<ShownOff | null>`
  - `reportBlock: ComputedRef<string | null>`
  - `canReport: ComputedRef<boolean>`
  - `reportOff(reason: OffReason, note: string | null): Promise<boolean>`
  - `withdrawOff(): Promise<boolean>`

**سلوكُ الدوالّ:**
- **`canReport`:** مثل `canWrite` في شروط الجلسة والنيابة والطلاب، و`reportBlock === null`، ولا إجازة، و`off?.status !== 'approved'`.
- **`withdrawOff`:**
  - إن كان السطرُ على الجهاز من نوع `off`، يُحذف من الصندوق بدالّة الحذف القائمة في `useOfflineQueue`.
  - وإن كان البلاغُ في النسخة غيرَ معتمَد، يُضاف سطرُ `withdraw`.
- **`canWrite`:** يُضاف إليه شرطان: لا إجازة، ولا بلاغٌ معروض.

**الشاشة:**
- **يومُ إجازة:** `HolidayBanner` وحده.
- **يومٌ فيه بلاغ:** `OffDayBanner` بلا قائمة. وزرّاه:
  - «تراجع — الحلقة انعقدت» ← `withdrawOff`.
  - مع الرفض يُضاف «عدّل البلاغ»، فيفتح النافذةَ معبّأة.
- **غيرُ ذلك:** القائمة كما هي.
  - بجانب «حفظ الحضور» زرٌّ ثانويّ «لم تنعقد الحلقة»، معطَّلٌ مع `reportBlock` ظاهراً تحته.
  - ومع `held` رابطٌ «لم تنعقد الحلقة في هذا اليوم؟».

**الخطوات:**
- [ ] **الخطوة 1: الاختبارات** في `useOfflineAttendance.test.ts`:
  - `reportOff` بلا اتصال يضع سطراً `off`.
  - ثمّ `withdrawOff` يحذفه، فلا سطرَ في الصندوق.
  - بلاغٌ في النسخة `pending` ← `withdrawOff` يضع سطرَ `withdraw`.
  - يومُ إجازة ← `canWrite` و`canReport` كلاهما `false`.
  - **محور المراجعة 3:** `reportOff` ثمّ `save()` لليوم نفسه ← سطرٌ واحدٌ نوعُه `attendance`.
- [ ] **الخطوة 2:** نفّذ.
- [ ] **الخطوة 3:** `npx vitest run app/composables/useOfflineAttendance.test.ts && npm run typecheck`. المتوقّع: الاختبارُ PASS، ولا
  أخطاءَ جديدة. الأخطاءُ القائمة المعروفة: `NewsSlider.vue:66` و`rewrite.post.ts:20-22`.
- [ ] **الخطوة 4:** أودِع `feat: بلاغُ «لم تنعقد الحلقة» في شاشة المعلّم بلا إنترنت`.

---

### المهمّة 5: «الحضور اليوميّ» `/attendance` — العرض والاعتماد

**الملفّات:**
- إنشاء: `app/components/attendance/OffDayReviewPanel.vue`. يعرض السببَ والملاحظةَ والحالة، ومَن بلّغ ومتى (`reported_at`). وللمعتمِد
  زرّا «قبول» و«رفض»، ومع الرفض حقلُ «سبب الرفض (اختياري)».
- تعديل:
  - `app/composables/useAttendanceDay.ts` واختبارُه.
  - `app/pages/attendance/index.vue`: يُضاف `gender` لقائمة الحلقات، ورابطٌ «أيام الإجازة» للمدير الإداري في الرأس.

**الواجهات:**
- **تنتج في `useAttendanceDay()`:**
  - `offDay: Ref<(OffDay & { id: string, reporterName: string | null, reportedAt: string }) | null>`
  - `holiday: Ref<string | null>`
  - `reviewOffDay(approve: boolean, note: string | null): Promise<boolean>`: عبر `rpc('review_off_day')`، ثمّ `load()`.
- **تنتج من `app/composables/usePermissions.ts`:**
  `export function canReviewOffDayRole(role: string | null | undefined, halaqaGender: string | null): boolean`، بقواعد
  `can_review_off_day`.

**الخطوات:**
- [ ] **الخطوة 1: الاختبارات:**
  - `canReviewOffDayRole('technical_manager', 'female')` = `false`، و`('women_admin', 'female')` = `true`.
  - `('field_supervisor', null)` = `true`، و`('project_supervisor', 'male')` = `false`.
- [ ] **الخطوة 2: الشاشة:**
  - **يومُ إجازة:** `HolidayBanner` بدل القائمة.
  - **يومٌ فيه بلاغ:** `OffDayReviewPanel` بدل القائمة.
  - **`canWrite`** يصير `false` مع الإجازة أو البلاغ المعتمَد.
  - **يومٌ له بلاغٌ معلّق أو مرفوض:** يُترك للإداريّ «حفظ الحضور». فإن حفظ حُذف البلاغ بحارس القاعدة، مع تنبيهٍ قبل الحفظ.
- [ ] **الخطوة 3:** `npx vitest run app/composables/useAttendanceDay.test.ts app/composables/usePermissions.test.ts`، ثمّ typecheck.
- [ ] **الخطوة 4:** أودِع `feat: البلاغُ والإجازة في «الحضور اليوميّ» واعتمادُ البلاغ`.

---

### المهمّة 6: بطاقةُ «أيامٌ لم تنعقد — بانتظار الاعتماد»

**الملفّات:**
- إنشاء: `app/composables/useOffDayQueue.ts` واختبارُه، و`app/components/dashboard/OffDayQueue.vue`.
- تعديل: `app/pages/dashboard.vue`. البطاقةُ في فرع المشرف الميدانيّ، وفي فرع المديرين لـ`admin_manager` و`technical_manager`
  و`women_admin`. **لا لمشرف المشروع.**

**الواجهات:**
- **`useOffDayQueue()`:**
  - يقرأ `attendance_off_days` حيث `status = 'pending'`، مرتّبةً باليوم، ومعها اسمُ الحلقة وجنسُها واسمُ المبلِّغ.
  - **يردّ:** `{ items, loading, load, review(id: string, approve: boolean, note: string | null): Promise<boolean> }`.
  - **نتيجةُ `review`:** الناجحُ يخرج من `items` فوراً، والفاشلُ عبر `useErrorHandler`.
- **ما يُعرض:**
  - تُعرض البنودُ التي `canReviewOffDayRole` لها صادقة.
  - **البطاقةُ لا تُركَّب إن لم يبقَ بند.**

**البطاقة:**
- **كلُّ سطر:** الحلقة · اليوم (dd/mm واسمُ يوم الأسبوع) · السبب والملاحظة · المبلِّغ، ثمّ «قبول» و«رفض» و«فتح اليوم» إلى
  `/attendance?h=&d=`.
- **الرفض:** نافذةٌ صغيرة لسببه الاختياريّ.

**الخطوات:**
- [ ] **الخطوة 1: الاختبار:** دالّةٌ نقيّة في الملفّ `visibleQueue(items, role)` تُسقط ما ليس للدور، ومنه حلقاتُ البنات عن المدير الفنيّ.
- [ ] **الخطوة 2:** نفّذ، ثمّ vitest وtypecheck.
- [ ] **الخطوة 3:** أودِع `feat: طابورُ اعتماد بلاغات «لم تنعقد» في لوحات المعتمِدين`.

---

### المهمّة 7: شاشة «أيام الإجازة» `/attendance/holidays`

**الملفّات:**
- إنشاء: `app/utils/holidays.ts` واختبارُه، و`app/composables/useHolidays.ts` واختبارُه، و`app/pages/attendance/holidays.vue`.
- تعديل:
  - `app/layouts/dashboard.vue`: بندٌ `{ key: 'holidays', label: 'أيام الإجازة', icon: 'i-lucide-calendar-off', to: '/attendance/holidays',
    roles: ['admin_manager'], group: 'quran', isNew: true }` بعد بند `attendance`.
  - `app/constants/navigation.ts`، إن لزم ضمُّ المسار إلى قوائمه.

**الواجهات:**
- **`expandHolidayRange(from: string, to: string): string[]`:** أيامُ المدى شاملةً طرفيه، بلا الجُمَع. ومدىً مقلوبٌ يُعامل بترتيب طرفيه.
- **`useHolidays()`** يردّ:
  - `list: Ref<{ day: string, reason: string }[]>`
  - `load()`
  - `add(days: string[], reason: string): Promise<boolean>`
  - `remove(day: string): Promise<boolean>`
  - `recordedHalaqat(days: string[]): Promise<number>`: عددُ الحلقات المتميّزة في `attendance_days` لتلك الأيام.
- **الشاشة:**
  - **لغير `admin_manager`:** `UiEmptyState` «هذه الشاشة للمدير الإداري».
  - **القائمة:** القادمةُ أوّلاً ثمّ الماضية.
  - **الإضافة:** «من يوم — إلى يوم» والسبب. ثمّ تأكيدٌ يقول «N يوم، وسجّلت فيها K حلقة حضوراً يبقى كما هو».
  - **الحذف:** بعد تأكيد.

**الخطوات:**
- [ ] **الخطوة 1: الاختبار** `expandHolidayRange('2026-11-05', '2026-11-08')`:
  - الأيام: الخميس 5، والسبت 7، والأحد 8؛ بلا الجمعة 6.
  - مقلوبُه يعطي النتيجةَ نفسها.
- [ ] **الخطوة 2:** نفّذ، ثمّ vitest وtypecheck.
- [ ] **الخطوة 3:** أودِع `feat: شاشةُ «أيام الإجازة» للمدير الإداري`.

---

### المهمّة 8: الإجازةُ والبلاغ في «متابعة الرصد» واللوحات، والتوثيق

**الملفّات:**
- تعديل:
  - `app/utils/recordingStatus.ts` واختبارُه.
  - `app/components/dashboard/RecordingFollowUp.vue`.
  - `app/utils/teacherDashboard.ts` واختبارُه.
  - `app/composables/useTeacherDashboard.ts`.
  - `app/pages/dashboard.vue`.
  - `docs/FEATURES.md` و`docs/PAGES.md` و`docs/ROADMAP.md`.
- إنشاء: `app/composables/useTodayHoliday.ts` واختبارُه.

**الواجهات:**
- **`DayState`** يصير `'held' | 'missed' | 'today' | 'before' | 'holiday' | 'off' | 'off_pending'`، و`parseRecent` يقبل الجديدة.
- **`DAY_META` في المكوّن:**

  | الحالة | الكلمة | الأيقونة |
  |---|---|---|
  | `holiday` | «إجازة» | `i-lucide-calendar-off` |
  | `off` | «لم تنعقد — معتمَد» | `i-lucide-calendar-x` |
  | `off_pending` | «لم تنعقد — بانتظار الاعتماد» | `i-lucide-calendar-clock` |

  ومفتاحُ الألوان يضمّ الحالات الثلاث. **وفي تفصيل اليوم:**
  - `off` و`off_pending`: سببُ البلاغ ورابطُ «فتح اليوم»، ويُقرأ البلاغ عند الفتح.
  - `holiday`: سببُ الإجازة.
- **`useTodayHoliday()`:** يردّ `{ reason: Ref<string | null> }` من `attendance_holidays` ليوم `gazaToday()`. فشلُه أو انقطاعُه = `null` بلا خطأ ظاهر.
- **`teacherActions`:** يقبل `todayAttendance.holiday: string | null`. فإن وُجدت الإجازة، يحلّ بندُ
  `{ key: 'att', tone: 'done', icon: 'i-lucide-calendar-off', title: 'اليوم إجازة: <السبب>', to: '/t' }` محلَّ بند الحضور.
- **`dashboard.vue`:** سطرٌ هادئ «اليوم إجازة: <السبب>» أعلى لوحات الكادر.

**الخطوات:**
- [ ] **الخطوة 1: الاختبارات:**
  - `parseRecent([{ day: '2026-10-29', state: 'off_pending' }])` يُبقيه.
  - `teacherActions` مع `holiday: 'عيد'` يردّ بندَ الإجازة لا «لم تسجّل حضور اليوم».
- [ ] **الخطوة 2:** نفّذ. ثمّ `npx vitest run` كاملاً و`npm run lint` و`npm run typecheck`. المتوقّع: لا فشلَ ولا خطأَ جديد.
- [ ] **الخطوة 3:** حدّث التوثيق. في `FEATURES.md` الوظيفةُ وسطرُ الـChangelog، وفي `PAGES.md` الشاشتان `/attendance/holidays`
  و`/t` و`/attendance`.
- [ ] **الخطوة 4:** أودِع `feat: الإجازةُ والبلاغ في «متابعة الرصد» واللوحات + التوثيق`.

---

## بعد المهامّ — للمتحكّم

1. **مراجعةٌ شاملة للفرع** على النموذج الأقدر.
2. **التجربةُ الحيّة** بخادم التطوير وحسابات المستخدم، بلا كتابة كلمات مرور:
   - المعلّمُ على الجوال **بقطعٍ حقيقيّ**: حضورٌ كما كان، ثمّ بلاغٌ بلا اتصال يُرفع، ثمّ تراجعٌ قبل الرفع.
   - المشرفُ يقبل ويرفض.
   - المدير الإداريّ يعيّن إجازةً، ثمّ يحذفها.
3. **بياناتُ التجربة** تُحذف بإذن المستخدم.
4. **بعد إذن المستخدم:** دمجٌ ونشر.
5. **رسالةٌ لجلسة «ترجمان»** فيها اسمُ الجدولين وأعمدتُهما والهجرةُ الفعليّة وطريقةُ التحقّق.
