# الاختبارات المرحلية (الجزء ٣ من الدفعة الثانية) — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** خطةُ اختباراتٍ من 15 دورة في 3 مراحل تبدأ من الناس (كصورة المستخدم)، بترتيبٍ إلزاميّ تحرسه القاعدة، مع تبويب «تقسيمة الأجزاء»، وإشعارَي الترشيح والنتيجة، ورحلةِ طالبٍ تقرأ الدورات — وكلُّ شاشات الاختبار بطاقاتٌ على الجوال.

**Architecture:** **جدولٌ جديد `exam_cycles` بجانب `exam_plan`** وعمودٌ جديد `exam_list_items.exam_cycle_id` — فلا يمسّ البناءُ الكودَ المنشور (الذي يقرأ `exam_plan.group_number/stage_type`) ولا يُعطّل الموقعَ الحيّ؛ والقديمُ (`exam_plan`، `exam_plan_id`، `guard_station_sequence`، `exam_stage_type`، `my_exam_results`) يُحذف **بعد النشر وبإذن المستخدم** (Task 8). حارسُ ترتيبٍ جديد بـ`sort_order`، ورفعُ `quran_parts` عند الاجتياز = عددُ الأجزاء المختبَرة من الناس (`31 − parts_from`).

**Tech Stack:** Supabase Postgres (موصل Supabase، `qwtqfkayupzijcoguqrf`)، Nuxt 4، `@nuxt/ui` v4، Vitest.

**المواصفة:** `docs/superpowers/specs/2026-10-19-v2-batch2-design.md` (الجزء ٣ + «عقد العمود الفقريّ») — **ومُعدَّلة هنا:** جدولٌ جديد بدل إعادة بناء `exam_plan` (سببه أعلاه).

## Global Constraints

- **مكان العمل:** شجرة العمل `/Users/aboomar/Developer/torjoman-v2b2` على `feature/v2-batch2` وحدها؛ لا يُلمس `/Users/aboomar/Developer/torjoman` (جلسةٌ أخرى). لا دفع ولا دمج إلا بإذن المستخدم. خادم التطوير حيّ على 3030 من هذه الشجرة: **لا `nuxt build` ولا `pnpm typecheck`** (يكتب `.nuxt`) — بل `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` للقراءة (الخطأ القائم سلفاً: `app/pages/students/index.vue:234` وحده).
- **الدلالات:** `program_juz` مرقّمٌ بترتيب الحفظ (30 = الناس…النبأ، 1 = البقرة 253 ← الفاتحة)؛ و`students.quran_parts` = **عددُ الأجزاء المحفوظة/المختبَرة من الناس** (0–30). الدورةُ `parts_from–parts_to` بأرقام أجزاء البرنامج (28–30 …)، وعددُ أجزائها المحقَّق بالاجتياز = `31 − parts_from`.
- **الترتيب الإلزاميّ:** الدورةُ المستحقّة = أوّلُ دورةٍ بـ`sort_order` لم يجتزها الطالب؛ لا ترشيح خارجها ولا مع ترشيحٍ بلا نتيجة؛ الراسب للدورة نفسها؛ بعد آخرِ دورة «أتمّ الخطة».
- **ما لا يتغيّر:** الرصد بعشرة بنود (9 أسئلة 0–10 + تجويد **7–9**)، درجة النجاح `app_settings.pass_mark` (80)، المجموعُ الأعلى **99**.
- كلُّ نصٍّ عربيّ، **الشهور بالأرقام**، RTL، لمس ≥ 44px، لا ألوان مباشرة، JSDoc عربيّ، ملفات ≤ 300 سطر.
- **الجوال:** كلُّ جدولٍ في شاشات الاختبار بطاقاتٌ تحت 720px بنمط الحاوية (`container-type: inline-size` + `@container (max-width: 719px)` يُخفي `.table-wrap` ويُظهر قائمة بطاقات) — كما في `app/pages/halqat/index.vue`؛ ولا تمرير أفقيّ على 375px.
- القاعدة: دوالّ لا يستدعيها العميل في `private`؛ كلُّ جدولٍ/دالّةٍ جديدة في `public` يُسحب منه المنح الافتراضيّ ثم يُمنح صراحةً؛ دوالّ السياسات `security definer` + `search_path` + منحٌ لـ`authenticated` (و`service_role` إن استُدعيت في مُشغِّل أو `WHEN`)؛ كلُّ هجرةٍ تفحص نفسها؛ اسمُ الملف = نسختُه الفعليّة؛ الإشعارات عبر `private.notify` وحدها (النوعان `exam_nominated` و`exam_graded` في القيد وقائمة التحقّق).
- بعد كلّ هجرةٍ تمسّ `public`: الأنواع بأداة `generate_typescript_types` إلى ملفٍّ مؤقّت ← إضافيّةٌ فقط ← تُستبدل.
- `pnpm lint && pnpm test` خضراء قبل كلّ إيداع؛ رسائل Conventional عربية تنتهي بـ`Co-Authored-By: Claude <النموذج الفعليّ> <noreply@anthropic.com>`.

## خريطة الملفات

| الملف | المسؤولية |
|---|---|
| `supabase/migrations/<v>_exam_cycles.sql` | `exam_cycles` + بذرةُ الدورات الـ15 + `exam_list_items.exam_cycle_id` + حارسُ الترتيب الجديد + رفعُ `quran_parts` + `my_exam_cycle_results()` + مُنتِجا الإشعارات |
| `app/utils/exams/cycles.ts` (+test) | تسميةُ الدورة، الدورةُ المستحقّة، عددُ أجزائها، تلميحُ «لم يبلغ حدودها» |
| `app/utils/journey.ts` (+test) | `buildJourney` يقرأ الدورات بالمراحل وبالاتّجاه النازل |
| `app/pages/exam-plan/index.vue` + `app/components/exams/PlanStage.vue` + `JuzTable.vue` | تبويبا «الخطة» و«تقسيمة الأجزاء» |
| `app/pages/exams/index.vue` (+ مكوّنات `app/components/exams/*`) | الترشيح والرصد والنتائج بالدورات، بطاقاتٌ على الجوال |
| `StudentJourney.vue` · `JourneyCard.vue` · `journeyInputs.ts` · `dashboard.vue` · `halqat/[id].vue` · `server/api/public/student/[token].get.ts` · `s/[token].vue` · `useNotifications.ts` | قرّاءُ الخطة القديمة ينتقلون إلى `exam_cycles` |
| `supabase/migrations/<v>_drop_exam_plan.sql` | **بعد النشر وبإذن المستخدم** |

---

### Task 1: القاعدة — جدولُ الدورات وحارسُه وإشعاراته

**Files:** Create `supabase/migrations/<v>_exam_cycles.sql`; Modify `app/types/database.types.ts`.

**Interfaces (Produces):**
- `public.exam_cycles(id smallint pk, stage_number smallint 1..3, cycle_number smallint 1..5, parts_from smallint, parts_to smallint, surahs_label text, sort_order smallint unique, created_at, updated_at)`؛ فريدٌ `(stage_number, cycle_number)`؛ `check (1 <= parts_from and parts_from <= parts_to and parts_to <= 30)`؛ `sort_order = (stage_number − 1) × 5 + cycle_number` (عمودٌ مولَّد أو قيدٌ يفرضه).
- `public.exam_list_items.exam_cycle_id smallint references public.exam_cycles(id) on delete restrict` (فارغٌ للبنود القديمة).
- `public.my_exam_cycle_results() returns table(exam_cycle_id smallint, passed boolean, total_score int, exam_date date)` — للطالب نفسه، `security definer`، `search_path=''`، لـ`authenticated` وحده.

- [ ] **Step 1: الهجرة:**
  1. الجدول + RLS: قراءةٌ لكلّ `authenticated`، كتابةٌ (`update` وحده — العددُ ثابت، لا إدراج ولا حذف من العميل) للمدير الإداري والفني (`public.current_user_role() in ('admin_manager','technical_manager')`)؛ سحبُ المنح الافتراضيّ ثم `grant select, update`؛ مُشغّل `set_updated_at`. **والتعديل يمسّ `parts_from/parts_to/surahs_label` وحدها** (مُشغّلٌ يمنع تغيير `stage_number/cycle_number/sort_order`).
  2. البذرة (حرفياً — صورة المستخدم، والدورة 3/3 «البقرة – النساء» بقرار المواصفة):

```sql
insert into public.exam_cycles (id, stage_number, cycle_number, parts_from, parts_to, surahs_label) values
  (1,1,1,28,30,'المجادلة – الناس'),(2,1,2,26,30,'الأحقاف – الناس'),(3,1,3,23,25,'يس – الجاثية'),
  (4,1,4,21,25,'العنكبوت – الجاثية'),(5,1,5,21,30,'العنكبوت – الناس'),
  (6,2,1,18,20,'المؤمنون – القصص'),(7,2,2,16,20,'مريم – القصص'),(8,2,3,13,15,'يوسف – الكهف'),
  (9,2,4,11,15,'يونس – الكهف'),(10,2,5,11,20,'يونس – القصص'),
  (11,3,1,8,10,'الأعراف – التوبة'),(12,3,2,6,10,'المائدة – التوبة'),(13,3,3,3,5,'البقرة – النساء'),
  (14,3,4,1,5,'البقرة – النساء'),(15,3,5,1,10,'البقرة – التوبة');
```
  3. `exam_list_items.exam_cycle_id` + فهرس.
  4. **حارسُ الترتيب** `private.guard_cycle_sequence()` (before insert or update of `exam_cycle_id, student_id` on `exam_list_items`، `security definer`، `search_path=''`)؛ يعمل حين `new.exam_cycle_id is not null`:
     - يرفض إن وُجد للطالب بندٌ آخر بدورةٍ بلا نتيجة («للطالب ترشيحٌ بانتظار الرصد»).
     - يرفض إن لم تكن الدورةُ هي المستحقّة: أوّلُ `exam_cycles` بـ`sort_order` لا نتيجةَ ناجحة لها لهذا الطالب (عبر `exam_list_items` + `exam_results.passed`) — «المستحقّةُ للطالب: المرحلة X · الدورة Y»؛ وإن أتمّ الكلّ «أتمّ الطالب الخطة».
     - ويمرّ إن كان `pg_trigger_depth() > 1` (تتابع).
  5. **رفعُ الأجزاء** — `create or replace` لـ`public.bump_parts_on_pass()` القائمة: إن كان للبند `exam_cycle_id` فـ`v_parts := 31 − parts_from` للدورة؛ وإلا السلوكُ القديم (`exam_plan.parts_to`) كما هو. **ويُضاف مُشغّلٌ `after update of passed`** (أو داخل الدالّة نفسها لـ`tg_op in ('INSERT','UPDATE')` مع `new.passed and not coalesce(old.passed,false)`) — يرفع ولا يُنزل أبداً.
  6. **المُنتِجان** (`private.notify` وحدها):
     - `exam_nominated`: مُشغّلٌ **على مستوى الجملة** `after insert on exam_list_items referencing new table as new_items` — لكلّ `exam_list_id` في الجديد: مختبِرُ الحلقة (`halaqat.examiner_id` عبر `exam_lists.halaqa_id`)، العنوان «ترشيحٌ جديد للاختبار»، النصّ `<الحلقة> · <N> طالباً`، الرابط `/exams`، المصدر `exam_lists`/معرّف القائمة.
     - `exam_graded`: `after insert on exam_results` — لمعلّم حلقة الطالب **وللطالب نفسه** (`students.user_id`)، العنوان «رُصدت نتيجةُ اختبار»، النصّ `<اسم الطالب> · <ناجح|راسب> · <المجموع>` (للطالب: «نتيجتُك: …»)، الرابط `/exams` (وللطالب `/me`)، المصدر `exam_results`/المعرّف.
  7. `public.my_exam_cycle_results()`.
  8. الفحص الذاتيّ: 15 دورة، `sort_order` 1..15 متّصل، المراحلُ تغطّي 30←1، المنح، المُشغّلات.
- [ ] **Step 2: طبّق واحفظ باسم النسخة، وتحقّق بجلساتٍ حقيقية** (كتلة `do` تنتهي برفعٍ يُلغي): معلّمُ «الفرقان» (1010) يرشّح طالباً جديداً للدورة 1 ← ينجح ويصل المختبِرَ `exam_nominated`؛ ترشيحٌ ثانٍ له قبل الرصد ← يُرفض؛ للدورة 2 مباشرةً ← يُرفض برسالة المستحقّة؛ المختبِر يرصد اجتيازاً (تجويد 8، مجموع ≥ 80) ← `quran_parts` = 3، ويصل المعلمَ والطالبَ `exam_graded`؛ الترشيح للدورة 2 ← ينجح؛ رسوبٌ ← `quran_parts` لا يتغيّر؛ **البنود القديمة بـ`exam_plan_id` تعمل كما كانت** (حارسُها القديم ما زال يحكمها).
- [ ] **Step 3: الأنواع، Commit** `feat(exams): جدولُ الدورات الخمس عشرة من الناس وحارسُ ترتيبها وإشعاراها`.

---

### Task 2: المنطقُ النقيّ للدورات والرحلة

**Files:** Create `app/utils/exams/cycles.ts` (+`cycles.test.ts`)؛ Modify `app/utils/journey.ts` (+test جديد `journey.test.ts`)، `app/utils/journeyInputs.ts` (+test).

**Interfaces (Produces):**
```ts
export interface ExamCycle { id: number, stage_number: number, cycle_number: number, parts_from: number, parts_to: number, surahs_label: string, sort_order: number }
export const STAGE_LABELS: Record<number, string>          // 1 'المرحلة الأولى' · 2 'المرحلة الثانية' · 3 'المرحلة الثالثة'
export const CYCLE_LABELS: Record<number, string>          // 1 'الدورة الأولى' … 5 'الدورة الخامسة'
export function cycleLabel(c: ExamCycle): string            // 'المرحلة الأولى · الدورة الأولى'
export function cycleRange(c: ExamCycle): string            // 'الأجزاء 28–30 (المجادلة – الناس)'
export function partsCount(c: ExamCycle): number            // parts_to − parts_from + 1
export function partsAfterPass(c: ExamCycle): number        // 31 − parts_from
export function dueCycle(cycles: ExamCycle[], passedIds: Set<number>, pendingIds: Set<number>): { cycle: ExamCycle | null, blocked: 'pending' | 'done' | null }
export function reachedHint(c: ExamCycle, juzReached: number): string | null   // «لم يبلغ موضعُه المعتمد حدودَ هذه الدورة بعد» إن juzReached < partsAfterPass(c)
```
- `buildJourney(quranParts, cycles, results)`: المحطّات = الدورات بـ`sort_order`؛ `reached = quranParts >= partsAfterPass(c)`؛ الاجتيازُ لا يُلغيه رسوبٌ لاحق؛ `nextStation`/`upcomingStation` كما اليوم؛ و`stageLabel` القديم يُستبدل بـ`cycleLabel`.
- **TDD:** `dueCycle` (لا شيء مجتاز ← 1؛ 1 و2 مجتازتان ← 3؛ 3 معلّقة ← blocked pending؛ الكلّ ← done؛ رسوبٌ في 3 ← 3)، `partsAfterPass` (28–30 ← 3؛ 21–30 ← 10؛ 1–10 ← 30)، `cycleRange`، `reachedHint`، و`buildJourney` (quranParts 3 ← الدورة 1 «بُلغت»؛ نجاحٌ ثم رسوب ← مجتازة).
- [ ] TDD ← التنفيذ ← Commit `feat(exams): منطقُ الدورات والرحلة بالمراحل — نقيٌّ ومختبَر`.

---

### Task 3: شاشةُ «خطة الاختبارات» بتبويبين

**Files:** Rewrite `app/pages/exam-plan/index.vue`؛ Create `app/components/exams/PlanStage.vue`, `app/components/exams/JuzTable.vue`.
- **تبويب «الخطة»:** ثلاثةُ أقسام (المرحلة الأولى/الثانية/الثالثة) بجدولٍ كصورة المستخدم: الدورات · عدد الأجزاء · تفصيل الأجزاء (`a – b` بالأرقام) · وصف السور؛ والدورةُ الخامسة مُبرزة (صفٌّ بخلفية `--navy`/نصٍّ فاتح بالمتغيّرات). المديران الإداري والفني: زرّ «تعديل» لكلّ دورة (نافذة: من جزء، إلى جزء، وصف السور؛ تحقّقٌ 1 ≤ من ≤ إلى ≤ 30)؛ والبقيّةُ قراءة.
- **تبويب «تقسيمة الأجزاء»:** جدول `program_juz` 30 ← 1: رقم الجزء · بدايته (`<سورة> <آية>` باسم السورة من `useQuranReference`) · نهايته؛ والجزء 1 ينتهي «الفاتحة 7».
- الجوال: بطاقاتٌ بنمط الحاوية. لا تمرير أفقيّ على 375.
- [ ] التنفيذ ← lint/test/vue-tsc ← Commit `feat(exams): خطةُ الاختبارات بالمراحل الثلاث وتقسيمةُ الأجزاء`.

---

### Task 4: شاشةُ الاختبارات — الترشيح والرصد والنتائج بالدورات

**Files:** Modify `app/pages/exams/index.vue` (يُقسَّم إن تجاوز 300 سطر إلى `app/components/exams/Nominate.vue` و`GradeQueue.vue`)، `app/components/exams/GradeModal.vue`، `app/components/exams/ResultsBrowser.vue`.
- **الترشيح (المعلم):** لكلّ طالبٍ نشط دورتُه المستحقّة ثابتةً (`dueCycle`) بعرض `cycleLabel` + `cycleRange`، وحالةٌ «بانتظار رصد المختبِر» أو «أتمّ الخطة»؛ وتلميحُ `reachedHint` بالأجزاء المكتملة المعتمدة (`completedJuz` لآخر نهايةٍ معتمَدة من `quran_records` — عبر `useQuranMonth` أو استعلامٍ واحد بـ`in(student_id)`) — تلميحٌ لا منع. الإرسال يُدرج `exam_list_items` بـ`exam_cycle_id` (لا `exam_plan_id`).
- **طابور الرصد (المختبِر والمديران):** البنود بـ`exam_cycle_id` بلا نتيجة، بعرض الدورة؛ و**البنود القديمة** (`exam_plan_id` بلا دورة) تُعرض بنطاقها القديم كما هي حتى تُحذف.
- **GradeModal:** نصُّ «المجموع من 100» ← «من 99»، والبقيّة كما هي.
- **ResultsBrowser:** الدورةُ بدل النطاق القديم؛ وفلاتر كما هي.
- **الجوال:** الطابور والنتائج بطاقاتٌ بنمط الحاوية.
- **الجرس (`useNotifications.ts`):** طابورُ المختبِر يصير **بنداً لكلّ قائمة ترشيح** معرّفُه `exam_lists.id` («قائمة ترشيح بانتظار رصدك · <الحلقة> · N») كي تُسقطه `pendingQueue` ما دام إشعارُ `exam_nominated` غيرَ مقروء؛ **ويُحذف بند المعلم الثابت `graded`** («N نتيجة رُصدت اليوم») لأنّ `exam_graded` يحلّ محلّه (عقد العمود الفقريّ أ).
- [ ] التنفيذ ← lint/test/vue-tsc ← Commit `feat(exams): الترشيحُ والرصدُ والنتائج بالدورات، وبطاقاتٌ على الجوال`.

---

### Task 5: الرحلةُ وقرّاءُ الخطة القديمة

**Files:** Modify `app/components/StudentJourney.vue`, `app/components/student/JourneyCard.vue`, `app/utils/journeyInputs.ts`, `app/pages/dashboard.vue` (لوحة المعلم: «المحطة القادمة» فقط — **لا تُعدّ تخطيطَ الجدول**؛ الجلسةُ الأخرى تحوّله بطاقاتٍ، فادمج `origin/dev` قبل هذه المهمّة)، `app/pages/halqat/[id].vue`, `server/api/public/student/[token].get.ts`, `app/pages/s/[token].vue`.
- كلُّها تقرأ `exam_cycles` (مرتّبةً بـ`sort_order`) والنتائجَ عبر `exam_list_items.exam_cycle_id` (والطالب عبر `my_exam_cycle_results()`).
- العرض: «المحطة القادمة: المرحلة الأولى · الدورة الثانية — الأجزاء 26–30»، و«اجتاز N من 15 دورة»، و«أتمّ الخطة» بعد الخامسة عشرة.
- `grep -rn "exam_plan\|stage_type\|group_number\|my_exam_results" app server` ← لا شيء إلا الأنواع المولّدة وطابور الرصد القديم (Task 4).
- [ ] التنفيذ ← lint/test/vue-tsc ← Commit `refactor(exams): الرحلةُ والصفحاتُ تقرأ الدورات بدل الخطة القديمة`.

---

### Task 6: التحقّق في المتصفّح والتوثيق

- [ ] المتحكّم في المتصفّح (المستخدم يُدخل الحسابات): المعلّم الثاني يرشّح طالباً ← المختبِر يرصد ← الجرس عند الطرفين، ورحلةُ الطالب؛ والخطة وتقسيمة الأجزاء على 375 بلا تمرير. ثم **تُحذف بيانات التجربة بالمعرّفات بإذن المستخدم**.
- [ ] التوثيق: `DATABASE.md` (exam_cycles، الحارس، المُنتِجان، `my_exam_cycle_results`)، `FEATURES.md`، `PAGES.md`، `ROADMAP.md` (بند 20 «آلية الاختبارات وتقسيمها» ✅، والدفعة الثانية: الجزء ٣ ✅)، و`CLAUDE.md` صفّ «خطة الاختبارات»، ووثيقة سيناريوهات التجريب (قسمَا المختبِر والمعلم وحالات الرفض) بعد النشر.
- [ ] Commit `docs(exams): توثيقُ الاختبارات المرحلية`.

---

### Task 7: (محجوز للمراجعة النهائية وإصلاحاتها)

---

### Task 8: حذفُ الخطة القديمة — **بعد النشر وبإذن المستخدم**

- [ ] بعد تأكّد النشر وإذن المستخدم صراحةً: حذفُ بيانات الاختبار القديمة التجريبية (قائمةٌ واحدة، بندان، نتيجتان على `exam_plan`) **بإذنه**، ثم `drop trigger` حارس `guard_station_sequence` ودالّته، و`alter table exam_list_items drop column exam_plan_id`، و`drop table exam_plan`، و`drop type exam_stage_type`، و`drop function my_exam_results()`، وفرعُ `exam_plan` في `bump_parts_on_pass`؛ وجعلُ `exam_cycle_id` غيرَ فارغ؛ مع فحصٍ ذاتيّ أنّ لا دالّة ولا عرض يشير إليها؛ وتحديثُ `supabase/tests/v2_rls.sql` (بلوكات `exam_plan`)، والأنواع، و`DATABASE.md`.
- [ ] Commit `refactor(db): حذفُ خطة الاختبارات القديمة`.
