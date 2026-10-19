# الحضور اليوميّ والإنجاز القرآنيّ (الجزء ٢ من الدفعة الثانية) — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** المعلم يسجّل غيابَ طلابه يومياً بالاستثناء، ويرصد إنجازَ كلّ طالبٍ الشهريّ بالسورة والآية (الصفحاتُ تُحسب من فهرس المصحف)، ويُرسله فيعتمده المديرون أو يُعيدونه بملاحظة؛ ويحلّ ذلك محلَّ التقرير الشهريّ القديم (الأنشطة والنقاط والدرجات) كلِّه.

**Architecture:** مراجعُ ثابتة في القاعدة (السور، فهرس الصفحات، تقسيمة أجزاء البرنامج) تُحمَّل مرّةً في العميل؛ جدولا حضورٍ بالاستثناء؛ `quran_records` تحت رأس `monthly_reports` المُبسَّط؛ حرّاسٌ في القاعدة لحالات الرصد وقفل الشهر؛ ومنطقٌ نقيٌّ مختبَر في `app/utils/quran/` يحسب الصفحات والموضع والمطلوب والتصنيف. **الحذفُ آخراً**: الأعمدة والجداول القديمة تُحذف في هجرةٍ أخيرة **بعد نشر الكود الجديد وبإذن المستخدم** (الكود المنشور الآن يقرؤها، وحذفُها قبله يُسقط صفحاتٍ حيّة بخطأ 400).

**Tech Stack:** Supabase Postgres (موصل Supabase، المشروع `qwtqfkayupzijcoguqrf`)، Nuxt 4، `@nuxt/ui` v4، Vitest.

**المواصفة:** `docs/superpowers/specs/2026-10-19-v2-batch2-design.md` — «الأسس المشتركة» و«الجزء ٢» و«عقدُ العمود الفقريّ».
**المرجع المنقول منه (قراءةٌ فقط):** `~/Developer/sahaba-schools` — المواضع مذكورة في كلّ مهمّة.

## Global Constraints

- **مكان العمل:** شجرة العمل `/Users/aboomar/Developer/torjoman-v2b2` على الفرع `feature/v2-batch2` وحدها؛ **لا يُلمس `/Users/aboomar/Developer/torjoman`** (جلسةٌ أخرى تعمل فيه). لا دفع ولا دمج إلا بإذن المستخدم. خادم التطوير (إن كان حيّاً) على المنفذ 3030 من هذه الشجرة: **لا `nuxt build`** والخادم حيّ.
- كلُّ نصٍّ يراه المستخدم بالعربية. **الشهور بالأرقام لا بالأسماء** (`10-2026`؛ لا `MONTH_NAMES` في الشاشات الجديدة)، والتواريخ `DD-MM-YYYY`، والمنطقة الزمنية `Asia/Gaza` («اليوم» = تاريخ غزة).
- **الحفظ من الناس إلى الفاتحة لكلّ الطلاب.** ترتيبُ الحفظ: السورة تنازلياً والآية داخلها تصاعدياً — الموضع `A` يسبق `B` إذا `A.surah > B.surah` أو (`A.surah = B.surah` و`A.ayah < B.ayah`). آخرُ المسار الفاتحة 1:7.
- **الجزءُ جزءُ البرنامج** (`program_juz`، على حدود السور، مرقّمٌ بترتيب الحفظ 30←1) لا جزءُ المصحف.
- **المطلوب الشهريّ** = `app_settings.target_memorization_pages` مُقسَّطاً بالحضور: `max(1, round(المطلوب × حضر ÷ أيام الحلقة))`، ولا مطلوب لمن لم يحضر يوماً.
- **قفلُ الشهر:** يُرسَل رصدُ الشهر ابتداءً من آخر يومٍ فيه، والخميسَ إن كان آخرُه جمعة. المسوّدةُ مفتوحةٌ قبله.
- **الحالات:** المعلم يعدّل ما دام `draft` ويُرسل؛ المعتمِد (`can_approve_in_halaqa`) يعتمد **من `submitted` فقط** أو يُعيد إلى `draft` **بملاحظةٍ إلزامية** (`return_note`)، ويُعيد المعتمَدَ إلى `draft` بملاحظة إن لزم. لا كتابةَ في سجلّات شهرٍ معتمَد ولا في حضوره.
- القاعدة: دوالُّ لا يستدعيها العميل في `private`؛ كلُّ جدولٍ/دالّةٍ جديدة في `public` **تُسحب منها المنوح الافتراضية** (`revoke all … from public, anon, authenticated`) ثم يُمنح ما يلزم صراحةً؛ دوالُّ السياسات `security definer` + `search_path` + منحٌ صريح لـ`authenticated`؛ وكلُّ هجرةٍ تفحص نفسها في كتلة `do` تُلغيها إن خالف الواقع.
- اسمُ ملف الهجرة = رقمُ نسختها الفعليّ في الإنتاج (`list_migrations` بعد التطبيق).
- الإشعارات عبر `private.notify(...)` وحدها (المُصلَّبة: لا تُسقط العملية الأصلية)؛ الأنواع `report_submitted` / `report_approved` / `report_returned` موجودة في القيد.
- بعد كلّ هجرةٍ تمسّ `public`: توليدُ الأنواع إلى ملفٍّ مؤقّت (أداة `generate_typescript_types` من الموصل)، يُفحص أنّه إضافيٌّ وغيرُ فارغ، ثم يُستبدل `app/types/database.types.ts`.
- الملفات ≤ 300 سطر، JSDoc عربيّ في أعلى كلّ مكوّن/composable، لا ألوان مباشرة خارج `main.css`، لمس ≥ 44px، RTL.
- `pnpm lint && pnpm test` خضراء، و`pnpm typecheck` بلا خطأٍ **جديد** (القائم سلفاً: `app/pages/students/index.vue:234`).
- رسائل الإيداع Conventional بالعربية، وآخرُ سطرٍ: `Co-Authored-By: Claude <النموذج الفعليّ> <noreply@anthropic.com>`.

## خريطة الملفات

| الملف | المسؤولية |
|---|---|
| `supabase/migrations/<v>_quran_reference.sql` | `surahs` · `quran_pages` · `program_juz` · `quran_page_of` |
| `supabase/migrations/<v>_attendance.sql` | `attendance_days` · `attendance_absences` · حرّاسهما وسياساتهما |
| `supabase/migrations/<v>_quran_records.sql` | `quran_records` · `return_note` · حارسُ مسار الحالات وقفلُ الشهر · لقطةُ المطلوب · مُنتِجو الإشعارات الثلاثة · `my_approved_pages` الجديدة و`my_quran_months()` |
| `app/constants/quran.ts` (+test) | ثوابت المصحف ووصفُ «N جزءاً وM صفحة» |
| `app/utils/quran/mushaf.ts` (+test) | `pageOf` · `surahFirstPage` · `surahLastPage` · `pagesMemorized` |
| `app/utils/quran/position.ts` (+test) | مقارنةُ المواضع بترتيب الحفظ · الموضعُ التالي · الأجزاءُ المكتملة · بدايةُ الطالب الجديد · الختم |
| `app/utils/quran/plan.ts` (+test) | تقسيطُ المطلوب وتصنيفُ الطالب |
| `app/utils/reportWindow.ts` (+test) | يومُ فتح الشهر · «اليوم» في غزة · تسميةُ الشهر بالأرقام |
| `app/utils/arabicSearch.ts` (+test) | طيُّ الإملاء العربي للبحث في السور (منقول) |
| `app/composables/useQuranReference.ts` (+test) | تحميلُ المراجع مرّةً في الجلسة |
| `app/composables/useAttendanceDay.ts` (+test) | يومُ الحلقة وغياباته |
| `app/pages/attendance/index.vue` | شاشةُ الحضور اليوميّ |
| `app/composables/useQuranMonth.ts` (+test) | بياناتُ الشهر وبناءُ صفوف الطلاب وحفظُ السجلّ وتغييرُ الحالة |
| `app/components/quran/MonthPicker.vue` | اختيارُ الشهر بالأرقام |
| `app/components/quran/OutcomeStrip.vue` | العدّادات الأربعة وشريطُ «اكتمل رصد» |
| `app/components/quran/StudentCard.vue` | بطاقةُ الطالب |
| `app/components/quran/RecordModal.vue` | نافذةُ الرصد بالسورة والآية |
| `app/components/quran/ReturnModal.vue` | الإعادةُ بملاحظة |
| `app/pages/reports/index.vue` | يُعاد كتابتُه شاشةَ «الإنجاز القرآني» |
| حذف: `app/components/reports/HonorsBoard.vue` · `app/composables/useGrades.ts` | |
| تعديل: `JourneyCard.vue` · `TimeProgress.vue` · `server/api/public/student/[token].get.ts` · `pages/s/[token].vue` · `pages/me.vue` · `pages/dashboard.vue` · `pages/metrics/index.vue` · `pages/index.vue` · `layouts/dashboard.vue` | قرّاءُ النموذج القديم |
| `supabase/migrations/<v>_drop_old_report_model.sql` | **بعد النشر وبإذن المستخدم** |

---

### Task 1: مراجعُ المصحف وتقسيمةُ البرنامج

**Files:**
- Create: `supabase/migrations/<v>_quran_reference.sql`
- Modify: `app/types/database.types.ts` (مولَّد)

**Interfaces:**
- Produces: `public.surahs(number smallint pk, name text, ayah_count smallint)` (114 صفّاً، مجموع الآيات 6236)؛ `public.quran_pages(page smallint pk, surah smallint, ayah smallint)` (604)؛ `public.program_juz(number smallint pk, start_surah, start_ayah, end_surah, end_ayah smallint)` (30)؛ `public.quran_page_of(p_surah smallint, p_ayah smallint) returns smallint`. قراءةٌ لـ`authenticated`، ولا كتابةَ لأحد.

- [ ] **Step 1: اكتب الهجرة.** البنية:

```sql
-- مراجعُ المصحف (الجزء ٢ من الدفعة الثانية، 2026-10-19). منقولةٌ من الصحابة:
-- السور من base_slice_schema، وفهرسُ الصفحات من quran_mushaf_index (Tanzil.net، مصحف المدينة 604 صفحات).
-- وتقسيمةُ أجزاء البرنامج من صورة المستخدم: على حدود السور، مرقّمةٌ بترتيب الحفظ من الناس (30) إلى البقرة والفاتحة (1).

create table public.surahs (
  number smallint primary key check (number between 1 and 114),
  name text not null unique,
  ayah_count smallint not null check (ayah_count > 0)
);

create table public.quran_pages (
  page smallint primary key check (page between 1 and 604),
  surah smallint not null references public.surahs (number),
  ayah smallint not null check (ayah > 0),
  unique (surah, ayah)
);
comment on table public.quran_pages is 'أوّلُ آيةٍ في كلّ صفحة من مصحف المدينة (604). الصفحةُ لموضعٍ = آخرُ صفحةٍ بدايتُها ≤ الموضع.';

create table public.program_juz (
  number smallint primary key check (number between 1 and 30),
  start_surah smallint not null references public.surahs (number),
  start_ayah smallint not null check (start_ayah > 0),
  end_surah smallint not null references public.surahs (number),
  end_ayah smallint not null check (end_ayah > 0)
);
comment on table public.program_juz is 'أجزاءُ البرنامج: على حدود السور، مرقّمةٌ بترتيب الحفظ (30 = الناس…النبأ، 1 = البقرة 253 ← الفاتحة).';
```

  ثم **البيانات:**
  - السور: انسخ حرفياً جملة `insert into public.surahs (number, name, ayah_count) values …;` من `~/Developer/sahaba-schools/supabase/migrations/20260725155124_base_slice_schema.sql` (الأسطر 844–873).
  - الصفحات: انسخ السلسلة النصّية الواحدة (`'1,1;2,1;2,6;…;112,1'`) من `~/Developer/sahaba-schools/supabase/migrations/20260727150000_quran_mushaf_index.sql` (السطر 51)، وأدرجها بلا عمود `juz`:

```sql
insert into public.quran_pages (page, surah, ayah)
select row_number() over (order by ord)::smallint,
       split_part(pair, ',', 1)::smallint,
       split_part(pair, ',', 2)::smallint
from unnest(string_to_array('<السلسلة المنسوخة حرفياً>', ';')) with ordinality as t(pair, ord);
```

  - أجزاء البرنامج (حرفياً):

```sql
insert into public.program_juz (number, start_surah, start_ayah, end_surah, end_ayah) values
  (30,114,1,78,40),(29,77,1,67,30),(28,66,1,58,22),(27,57,1,51,60),(26,50,1,46,35),
  (25,45,1,42,53),(24,41,1,39,75),(23,38,1,36,83),(22,35,1,33,73),(21,32,1,29,69),
  (20,28,1,27,93),(19,26,1,25,77),(18,24,1,23,118),(17,22,1,21,112),(16,20,1,19,98),
  (15,18,1,17,111),(14,16,1,15,99),(13,14,1,12,111),(12,11,1,11,123),(11,10,1,10,109),
  (10,9,1,9,129),(9,8,1,8,75),(8,7,1,7,206),(7,6,1,6,165),(6,5,1,5,120),
  (5,4,1,4,176),(4,3,1,3,200),(3,2,1,2,141),(2,2,142,2,252),(1,2,253,1,7);
```

  - الدالّة:

```sql
create or replace function public.quran_page_of(p_surah smallint, p_ayah smallint)
returns smallint language sql stable security definer set search_path = '' as $$
  select p.page from public.quran_pages p
   where (p.surah, p.ayah) <= (p_surah, p_ayah)
   order by p.page desc limit 1;
$$;
```

  - الصلاحيات:

```sql
alter table public.surahs enable row level security;
alter table public.quran_pages enable row level security;
alter table public.program_juz enable row level security;
revoke all on public.surahs, public.quran_pages, public.program_juz from public, anon, authenticated;
grant select on public.surahs, public.quran_pages, public.program_juz to authenticated;
create policy surahs_read on public.surahs for select to authenticated using (true);
create policy quran_pages_read on public.quran_pages for select to authenticated using (true);
create policy program_juz_read on public.program_juz for select to authenticated using (true);
revoke all on function public.quran_page_of(smallint, smallint) from public, anon;
grant execute on function public.quran_page_of(smallint, smallint) to authenticated;
```

  - **الفحص الذاتيّ** (`do $$ … $$`، يرفع استثناءً عند أيّ خلل):
    - 114 سورة ومجموعُ `ayah_count` = 6236؛ 604 صفحة؛ 30 جزءاً.
    - معالم: `quran_page_of(1,1)=1`، `quran_page_of(2,1)=2`، `quran_page_of(114,6)=604`.
    - الصفحاتُ تصاعديةٌ صارمة بـ`(surah, ayah)` (`lag()`)، ولا بدايةَ صفحةٍ تتجاوز عددَ آيات سورتها.
    - **اتّصالُ أجزاء البرنامج بترتيب الحفظ:** الجزء 30 يبدأ بـ(114,1)، والجزء 1 ينتهي بـ(1,7)؛ ولكلّ جزءٍ `n` من 30 إلى 2: بدايةُ `n−1` = «الموضعُ التالي» لنهاية `n` — أي `(end_surah, end_ayah+1)` إن كانت `end_ayah < ayah_count(end_surah)`، وإلا `(end_surah−1, 1)`؛ ولا نهايةَ تتجاوز عددَ آيات سورتها؛ وفي كلّ جزءٍ البدايةُ تسبق النهايةَ بترتيب الحفظ.
    - المنوح: `authenticated` يقرأ الثلاثة ولا يكتب (`has_table_privilege` لـ insert/update/delete = false)، و`anon` لا يقرأ.

- [ ] **Step 2: طبّقها** (`apply_migration`، الاسم `quran_reference`)، واحفظ الملف باسم نسختها الفعليّة.
- [ ] **Step 3: ولّد الأنواع** وافحصها (إضافيّةٌ فقط: الجداول الثلاثة والدالّة).
- [ ] **Step 4: Commit** — `feat(quran): مراجعُ المصحف — السور وفهرسُ الصفحات وتقسيمةُ أجزاء البرنامج`.

---

### Task 2: المنطقُ النقيّ للمصحف والموضع والمطلوب وقفل الشهر

**Files:**
- Create: `app/constants/quran.ts`, `app/constants/quran.test.ts`
- Create: `app/utils/quran/mushaf.ts`, `app/utils/quran/mushaf.test.ts`
- Create: `app/utils/quran/position.ts`, `app/utils/quran/position.test.ts`
- Create: `app/utils/quran/plan.ts`, `app/utils/quran/plan.test.ts`
- Create: `app/utils/reportWindow.ts`, `app/utils/reportWindow.test.ts`
- Create: `app/utils/arabicSearch.ts`, `app/utils/arabicSearch.test.ts`

**Interfaces (Produces):**

```ts
// app/constants/quran.ts
export const MUSHAF_PAGES = 604
export const PROGRAM_JUZ_COUNT = 30
export const PAGES_PER_JUZ = 20
export const KHATM_POSITION = { surah: 1, ayah: 7 } as const
export function monthlyJuzLabel(pages: number): string | null

// app/utils/quran/mushaf.ts
export interface MushafPage { page: number, surah: number, ayah: number }
export function pageOf(index: MushafPage[], surah: number, ayah: number): MushafPage | null
export function surahFirstPage(index: MushafPage[], surah: number): number | null
export function surahLastPage(index: MushafPage[], surah: number): number | null
export function pagesMemorized(index: MushafPage[], start: Position, end: Position): number | null

// app/utils/quran/position.ts
export interface Position { surah: number, ayah: number }
export interface ProgramJuz { number: number, start: Position, end: Position }
export function comparePositions(a: Position, b: Position): number   // <0 إن سبق a بترتيب الحفظ
export function isInMemorizationOrder(from: Position, to: Position): boolean   // from ≤ to
export function nextPosition(end: Position, ayahCountOf: (surah: number) => number): Position | null
export function completedJuz(lastEnd: Position | null, juz: ProgramJuz[]): number
export function startForNewStudent(quranParts: number, juz: ProgramJuz[]): Position | null
export function isKhatm(p: Position | null): boolean

// app/utils/quran/plan.ts
export type PlanBasis = 'full' | 'prorated' | 'absent'
export interface ProratedPlan { required: number | null, full: number | null, basis: PlanBasis }
export function proratePlan(input: { required: number | null, daysHeld: number | null, daysAttended: number | null }): ProratedPlan
export type Outcome = 'done' | 'short' | 'unmeasured' | 'unrecorded'
export function outcomeOf(pages: number | null, plan: ProratedPlan): Outcome
export const OUTCOME_LABELS: Record<Outcome, string>   // أنجز · مقصّر · لا يُقاس · لم يُرصد

// app/utils/reportWindow.ts
export function gazaToday(now?: Date): string                                   // 'YYYY-MM-DD'
export function openingDay(year: number, month: number): string                  // 'YYYY-MM-DD'
export function isSubmittable(year: number, month: number, today: string): boolean
export function periodLabel(year: number, month: number): string                 // '10-2026'
export function formatDay(iso: string): string                                   // '19-10-2026'
export function shiftMonth(year: number, month: number, by: number): { year: number, month: number }

// app/utils/arabicSearch.ts
export function arabicFold(s: string): string
export function filterByLabel<T extends { label: string }>(items: T[], query: string): T[]
```

**مصادر النقل:** `mushaf.ts` من `~/Developer/sahaba-schools/app/composables/useMushafIndex.ts` (الأسطر 24–127: `pageOf`، `surahFirstPage`، `surahLastPage`، `pagesMemorized` — بلا `juz` في `MushafPage` وبلا `pagesBetween`)؛ `monthlyJuzLabel` من `app/constants/quran.ts` (280–305)؛ `proratePlan` من `app/utils/attendancePlan.ts` (44–76)؛ `arabicSearch.ts` كما هو من `app/utils/arabicSearch.ts` (60 سطراً) مع اختباره إن وُجد (`app/utils/arabicSearch.test.ts`) أو اختبارٍ جديد.

**الدوالّ الجديدة (اكتبها هكذا):**

```ts
export function comparePositions(a: Position, b: Position): number {
  if (a.surah !== b.surah) return b.surah - a.surah
  return a.ayah - b.ayah
}

export function isInMemorizationOrder(from: Position, to: Position): boolean {
  return comparePositions(from, to) <= 0
}

/** الآيةُ التي تلي نهايةً بترتيب الحفظ؛ null بعد الفاتحة 1:7 (الختم). */
export function nextPosition(end: Position, ayahCountOf: (surah: number) => number): Position | null {
  if (end.ayah < ayahCountOf(end.surah)) return { surah: end.surah, ayah: end.ayah + 1 }
  if (end.surah === 1) return null
  return { surah: end.surah - 1, ayah: 1 }
}

/** الأجزاءُ المكتملة حتى آخر موضعٍ معتمَد: كلُّ جزءٍ نهايتُه ≤ الموضع. */
export function completedJuz(lastEnd: Position | null, juz: ProgramJuz[]): number {
  if (!lastEnd) return 0
  return juz.filter(j => comparePositions(j.end, lastEnd) <= 0).length
}

/** بدايةُ رصد طالبٍ بلا سجلٍّ سابق: أوّلُ الجزء الذي يلي ما يحفظه (0 ← الناس 1)، وnull لمن أتمّ الثلاثين. */
export function startForNewStudent(quranParts: number, juz: ProgramJuz[]): Position | null {
  const next = juz.find(j => j.number === 30 - Math.max(0, Math.min(30, quranParts)))
  return next ? { ...next.start } : null
}

export function isKhatm(p: Position | null): boolean {
  return !!p && p.surah === KHATM_POSITION.surah && p.ayah === KHATM_POSITION.ayah
}
```

```ts
export function outcomeOf(pages: number | null, plan: ProratedPlan): Outcome {
  if (pages === null) return 'unrecorded'
  if (plan.required === null) return 'unmeasured'
  return pages >= plan.required ? 'done' : 'short'
}
export const OUTCOME_LABELS: Record<Outcome, string> = { done: 'أنجز', short: 'مقصّر', unmeasured: 'لا يُقاس', unrecorded: 'لم يُرصد' }
```

```ts
const TZ = 'Asia/Gaza'
export function gazaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function openingDay(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0))             // آخرُ يومٍ في الشهر
  if (last.getUTCDay() === 5) last.setUTCDate(last.getUTCDate() - 1)   // الجمعة ← الخميس
  return last.toISOString().slice(0, 10)
}
export function isSubmittable(year: number, month: number, today: string): boolean {
  return today >= openingDay(year, month)
}
export function periodLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}-${year}`
}
export function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}
export function shiftMonth(year: number, month: number, by: number) {
  const idx = year * 12 + (month - 1) + by
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}
```

**اختباراتٌ إلزامية (TDD — اكتبها أوّلاً وشغّلها لتفشل):**
- `quran.test.ts`: `monthlyJuzLabel(19)=null`، `(20)='جزء'`، `(40)='جزءان'`، `(431)` = «21 جزءاً و11 صفحة» (طابِق صيغة الصحابة).
- `mushaf.test.ts` بفهرسٍ مصغّر مركّب يدوياً **وبالفهرس الحقيقيّ** (انسخ السلسلة إلى ثابتٍ في ملف الاختبار): `pagesMemorized(الناس 1 → النبأ 40) = 604 − pageOf(النبأ 1) + 1` (اقرأ `pageOf(78,1)` من الفهرس الحقيقيّ في الاختبار نفسه، وتحقّق أنّها 582)، وجزءٌ داخل سورةٍ واحدة يعطي صفحاتِه، والنطاقُ المقلوب يعطي القيمة نفسها.
- `position.test.ts`: (114,1) يسبق (113,1)؛ (2,1) يسبق (2,142)؛ (2,286) يسبق (1,1)؛ `nextPosition((114,6))=(113,1)`، `((2,141))=(2,142)`، `((1,7))=null`؛ `completedJuz((78,40))=1`، `((78,39))=0`، `((1,7))=30`، `(null)=0` — بقائمة الأجزاء الثلاثين من Task 1 مكتوبةً ثابتاً في الاختبار؛ `startForNewStudent(0)=(114,1)`، `(3)` = بدايةُ الجزء 27 = (57,1)، `(30)=null`؛ `isKhatm((1,7))=true`.
- `plan.test.ts`: حالاتُ `proratePlan` الستّ (بلا خطة · أيام=0 · حضر=0 ← absent · حضر=كامل ← full · 20 من 25 بمطلوب 35 ← 28 · لا يقلّ عن 1)، و`outcomeOf` الأربع.
- `reportWindow.test.ts`: `openingDay(2026,10)='2026-10-31'` (سبت)، `openingDay(2026,7)`: 31-07-2026 جمعة ← `'2026-07-30'`؛ `isSubmittable(2026,10,'2026-10-30')=false` و`'2026-10-31'=true`؛ `periodLabel(2026,1)='01-2026'`؛ `shiftMonth(2026,1,-1)={2025,12}`؛ `gazaToday(new Date('2026-10-19T22:30:00Z'))='2026-10-20'`.
- `arabicSearch.test.ts`: «يس» و«ياسين» يجدان «يس»؛ «النبا» يجد «النبأ»؛ «ال عمران» يجد «آل عمران».

- [ ] **Step 1–4:** اختبارات (RED) ← تنفيذ ← (GREEN) ← `pnpm lint && pnpm test`.
- [ ] **Step 5: Commit** — `feat(quran): منطقُ المصحف والموضع والمطلوب وقفل الشهر — نقيٌّ ومختبَر`.

---

### Task 3: الحضورُ اليوميّ — القاعدة

**Files:** Create `supabase/migrations/<v>_attendance.sql`; Modify `app/types/database.types.ts`.

**Interfaces (Produces):** `public.attendance_days(halaqa_id uuid, day date, recorded_by uuid, created_at)` PK `(halaqa_id, day)`؛ `public.attendance_absences(halaqa_id uuid, day date, student_id uuid, kind text check in ('excused','unexcused'), recorded_by, created_at)` PK `(day, student_id)` و FK `(halaqa_id, day) → attendance_days on delete cascade`.

- [ ] **Step 1: الهجرة:**
  - الجدولان كما أعلاه؛ `recorded_by uuid references public.profiles(id) on delete set null default auth.uid()`؛ فهرس `attendance_absences (student_id, day)`.
  - `private.attendance_today()` = `(now() at time zone 'Asia/Gaza')::date`.
  - حارسُ `attendance_days` (before insert/update/delete، `security definer`، `search_path=''`): لا يومَ بعد اليوم (`day > private.attendance_today()` ← رفض «لا يُسجَّل يومٌ لم يأتِ»)؛ ولا كتابةَ إن كان رصدُ شهر ذلك اليوم لتلك الحلقة `approved` («الشهر معتمَد — يُعيده المعتمِد أوّلاً»).
  - حارسُ `attendance_absences`: الطالبُ في الحلقة نفسها (`students.halaqa_id = new.halaqa_id`) عند الإدراج، والطالبُ ملتحقٌ قبل اليوم (`enrollment_date is null or enrollment_date <= new.day`)، ولا كتابةَ في شهرٍ معتمَد.
  - RLS:
    - `attendance_days`: قراءة `public.can_view_halaqa(halaqa_id) or halaqa_id = public.my_halaqa_id()`؛ كتابة (insert/update/delete) `public.is_halaqa_teacher(halaqa_id) or public.can_approve_in_halaqa(halaqa_id)`.
    - `attendance_absences`: قراءة `public.can_view_halaqa(halaqa_id) or student_id = public.my_student_id()`؛ كتابةٌ بالشرط نفسه.
  - المنوح: `revoke all … from public, anon, authenticated` ثم `grant select, insert, update, delete … to authenticated`.
  - الفحص الذاتيّ: RLS مفعّل، 2 سياسة قراءة، منوح `anon` معدومة، والحارسان موجودان.
- [ ] **Step 2: طبّق واحفظ باسم النسخة، وتحقّق بجلساتٍ حقيقية** في كتلة `do` تنتهي بـ`raise exception 'rollback-ok: …'`: معلّمُ «تجريبي — حلقة النور» (رقمه الوظيفي 1009) يفتح يوماً ويُسجّل غائباً من طلابه ← ينجح؛ يوماً في الغد ← يُرفض؛ طالباً من حلقةٍ أخرى ← يُرفض؛ معلّمٌ آخر يكتب في حلقة النور ← صفر صفوف/رفض؛ الطالب يقرأ غيابَه وحده.
- [ ] **Step 3: الأنواع.**
- [ ] **Step 4: Commit** — `feat(attendance): الحضورُ اليوميّ بالاستثناء — يومُ الحلقة وغياباتُها وحرّاسها`.

---

### Task 4: الرصدُ الشهريّ — القاعدة

**Files:** Create `supabase/migrations/<v>_quran_records.sql`; Modify `app/types/database.types.ts`.

**Interfaces (Produces):**
- `public.quran_records(id uuid pk, report_id uuid → monthly_reports on delete cascade, student_id uuid → students on delete cascade, from_surah smallint → surahs, from_ayah smallint, to_surah smallint → surahs, to_ayah smallint, pages_memorized smallint not null default 0 check 0..604, pages_reviewed smallint null check 0..604, notes text ≤500, recorded_by uuid default auth.uid(), created_at, updated_at)`، فريدٌ على `(report_id, student_id)`، وقيدٌ: المواضعُ الأربعة كلُّها فارغة أو كلُّها ممتلئة، و`(from_surah is not null or pages_memorized = 0)`.
- `monthly_reports.return_note text` (جديد، ≤ 500).
- `public.my_approved_pages()` تُعاد كتابتُها: مجموعُ `quran_records.pages_memorized` في التقارير المعتمدة لـ`my_student_id()`.
- `public.my_quran_months() returns table(report_year int, report_month int, from_surah smallint, from_ayah smallint, to_surah smallint, to_ayah smallint, pages_memorized smallint, pages_reviewed smallint)` — المعتمَدُ وحدَه للطالب نفسه، `security definer`، `search_path=''`، لـ`authenticated` وحده.

- [ ] **Step 1: الهجرة:**
  1. الجدول والقيود وفهرس `(student_id)` ومُشغّل `set_updated_at` القائم (`public.set_updated_at()`).
  2. حارسُ السجلّ (before insert/update، `security definer`، `search_path=''`): الآيتان ضمن `surahs.ayah_count`؛ و«من» ≤ «إلى» بترتيب الحفظ (`from_surah > to_surah or (from_surah = to_surah and from_ayah <= to_ayah)`)؛ وعند الإدراج الطالبُ في حلقة التقرير؛ **ولا كتابةَ إن كان التقرير `approved`**.
  3. RLS: قراءة `exists (select 1 from monthly_reports r where r.id = report_id and (public.can_view_halaqa(r.halaqa_id) or (student_id = public.my_student_id() and r.status = 'approved')))`؛ كتابة `exists (… r where r.id = report_id and ((public.is_halaqa_teacher(r.halaqa_id) and r.status = 'draft') or public.can_approve_in_halaqa(r.halaqa_id)))`. المنوح: سحبٌ ثم `select, insert, update, delete` لـ`authenticated`.
  4. `alter table monthly_reports add column return_note text check (return_note is null or char_length(return_note) <= 500)`.
  5. **لقطةُ المطلوب:** مُشغّلٌ قبل إدراج `monthly_reports` يملأ `target_pages_snapshot` من `app_settings.target_memorization_pages` إن كان فارغاً.
  6. **مسارُ الحالات وقفلُ الشهر** — مُشغّلٌ جديد `monthly_reports_flow` (before update، `security definer`، `search_path=''`؛ يمرّ إن كان `auth.uid()` فارغاً)، يعمل مع `guard_report_status` القائم ولا يحلّ محلّه:
     - `draft → submitted`: يُرفض قبل `private.report_opening_day(year, month)` («يُرصَد الشهر ابتداءً من DD-MM-YYYY»)؛ ويضبط `submitted_at = اليوم بتوقيت غزة` و`return_note = null`.
     - `→ approved`: من `submitted` وحدها («لا يُعتمَد إلا رصدٌ مُرسَل»)؛ ويضبط `approved_by = auth.uid()` و`approved_at = now()`.
     - `submitted|approved → draft`: يشترط `btrim(coalesce(new.return_note,'')) <> ''` («الإعادةُ تحتاج ملاحظة»)، ويمسح `approved_by/approved_at`.
     - `private.report_opening_day(p_year int, p_month int) returns date`: آخرُ يومٍ في الشهر، والخميسَ إن كان جمعة (`extract(isodow …) = 5`).
  7. **مُنتِجو الإشعارات** — مُشغّلٌ بعد `update of status` على `monthly_reports` (`private.notify_report_status`):
     - → `submitted`: لكلّ معتمِدٍ نشط — `profiles where status = 'active' and (role in ('admin_manager','technical_manager') or (role = 'women_admin' and <جنس الحلقة> = 'female'))` — `report_submitted`، العنوان «رصدُ شهرٍ بانتظار اعتمادك»، النصّ `<اسم الحلقة> · MM-YYYY`، الرابط `/reports`، المصدر `monthly_reports`/المعرّف.
     - → `approved`: لمعلّم الحلقة `report_approved`، «اعتُمد رصدُ الشهر»، النصّ نفسه.
     - → `draft` من `submitted|approved`: لمعلّم الحلقة `report_returned`، «أُعيد رصدُ الشهر إليك»، النصّ `<الحلقة> · MM-YYYY — <return_note>`.
  8. `my_approved_pages()` الجديدة و`my_quran_months()`؛ `revoke … from public, anon` و`grant execute … to authenticated`.
  9. الفحص الذاتيّ: الجدول والسياسات والمنوح، والمُشغّلات الثلاثة، و`report_opening_day(2026,7) = '2026-07-30'` و`(2026,10) = '2026-10-31'`.
- [ ] **Step 2: طبّق واحفظ، وتحقّق بجلساتٍ حقيقية** (كتلة `do` تنتهي برفعٍ يُلغي): معلّمُ حلقة النور ينشئ تقرير 10-2026 ويدرج سجلّاً (من 114:1 إلى 112:4) ← ينجح وتُملأ لقطةُ المطلوب؛ سجلٌّ مقلوبُ الترتيب ← يُرفض؛ آيةٌ فوق عدد آيات سورتها ← يُرفض؛ الإرسال قبل 31-10 ← يُرفض بالرسالة (لاختبار النجاح استعمل تقرير 09-2026)؛ المعلّم يعتمد ← يُرفض؛ المدير الإداري يعتمد مسوّدة ← يُرفض؛ يعتمد المُرسَل ← ينجح ويصل المعلمَ `report_approved`، ويصل المعتمدين `report_submitted` عند الإرسال؛ الإعادةُ بلا ملاحظة ← تُرفض، وبملاحظة ← تنجح ويصل `report_returned`؛ الكتابةُ في سجلّ تقريرٍ معتمَد ← تُرفض؛ الطالب يرى سجلَّه المعتمَد وحده عبر `my_quran_months()`.
- [ ] **Step 3: الأنواع.**
- [ ] **Step 4: Commit** — `feat(quran): الرصدُ الشهريّ بالسورة والآية — السجلّ وحرّاسُه ومسارُ الاعتماد وإشعاراتُه`.

---

### Task 5: مراجعُ العميل وشاشةُ الحضور اليوميّ

**Files:**
- Create: `app/composables/useQuranReference.ts` (+test)، `app/composables/useAttendanceDay.ts` (+test)، `app/pages/attendance/index.vue`
- Modify: `app/layouts/dashboard.vue` (عنصر القائمة)

**Interfaces:**
- Consumes: Task 1–3، `gazaToday`/`formatDay` (Task 2).
- Produces:
  - `useQuranReference(): { surahs: Ref<SurahRef[]>, pages: Ref<MushafPage[]>, juz: Ref<ProgramJuz[]>, ready: Ref<boolean>, load(): Promise<void>, ayahCountOf(n: number): number, surahName(n: number): string }` — `useState` يعيش الجلسة، وطلبٌ واحد لكلٍّ من الجداول الثلاثة عند أوّل `load()`. `SurahRef = { number, name, ayahCount }`. ودالّةٌ نقيّة مُصدَّرة مختبَرة `toProgramJuz(rows)`.
  - `useAttendanceDay(halaqaId: Ref<string | null>, day: Ref<string>)` ← `{ held: Ref<boolean>, absences: Ref<Record<string, 'excused' | 'unexcused'>>, locked: Ref<boolean>, load, setHeld(on: boolean), setAbsence(studentId, kind: 'present' | 'excused' | 'unexcused') }` — `setHeld(false)` يحذف اليوم (وتُحذف غياباته تتابعاً) بعد تأكيدٍ في الشاشة؛ `locked` = رصدُ الشهر معتمَد. ودالّةٌ نقيّة مُصدَّرة مختبَرة `summarizeDay(students, absences)` ← `{ present, excused, unexcused }`.
- **الشاشة `/attendance`** («الحضور اليوميّ»): المعلم حلقتُه تلقائياً؛ المعتمِدون/المديران قائمةُ حلقاتٍ (`UiSelect`). تاريخٌ (افتراضاً اليوم بغزة، لا مستقبل، سهما يومٍ سابق/لاحق، يُعرض `DD-MM-YYYY`). مفتاحُ «انعقدت الحلقة اليوم» — إن لم تنعقد فلا قائمة. القائمةُ: الطلاب النشطون (`students.status='active'`، الملتحقون حتى اليوم) لكلٍّ مقطعٌ ثلاثيّ (`حاضر` · `غائب بعذر` · `غائب بلا عذر`) يحفظ فوراً، ونصُّ ملخّصٍ «حضر 22 · بعذر 1 · بلا عذر 2». شارةُ قفلٍ إن كان الشهر معتمَداً. مشرف المشروع قراءةٌ فقط (`isReadOnly`).
- **القائمة الجانبية:** عنصر `{ key: 'attendance', label: 'الحضور اليوميّ', icon: 'i-lucide-calendar-check', to: '/attendance', roles: ['admin_manager', 'technical_manager', 'women_admin', 'project_supervisor', 'teacher'] }`، بعد عنصر `/reports` في مصفوفة القائمة القائمة.
- [ ] TDD للدالّتين النقيّتين ← التنفيذ ← الفحوص ← Commit `feat(attendance): شاشةُ الحضور اليوميّ — يومُ الحلقة وغياباتُها بضغطة`.

---

### Task 6: بياناتُ الشهر — `useQuranMonth`

**Files:** Create `app/composables/useQuranMonth.ts` (+test).

**Interfaces:**
- Consumes: Task 1–5.
- Produces:
```ts
export interface StudentMonthRow {
  studentId: string
  name: string
  record: { id: string, from: Position | null, to: Position | null, pagesMemorized: number, pagesReviewed: number | null, notes: string | null } | null
  suggestedFrom: Position | null          // بعد آخر نهايةٍ سابقة، وإلا startForNewStudent
  daysHeld: number                        // أيامُ الحلقة في الشهر منذ التحاقه
  daysAttended: number
  plan: ProratedPlan
  outcome: Outcome
  juzDone: number                          // completedJuz لآخر موضعٍ **معتمَد** (لا يدخله الشهر الحاليّ ما لم يُعتمد)
  khatm: boolean
}
export function buildStudentRows(input: {
  students: { id: string, full_name: string, enrollment_date: string | null, quran_parts: number }[]
  records: QuranRecordRow[]                         // سجلّات هذا الشهر
  previousEnds: Record<string, Position | null>     // آخرُ «إلى» في شهرٍ سابق (أيّ حالة)
  approvedEnds: Record<string, Position | null>     // آخرُ «إلى» معتمَد
  days: string[]                                     // أيامُ الحلقة في الشهر
  absences: { student_id: string, day: string }[]
  target: number | null
  juz: ProgramJuz[]
  ayahCountOf: (s: number) => number
}): StudentMonthRow[]
export function summarizeOutcomes(rows: StudentMonthRow[]): Record<Outcome, number> & { recordedPct: number }
export function useQuranMonth(halaqaId: Ref<string | null>, year: Ref<number>, month: Ref<number>): {
  report: Ref<ReportHeader | null>, rows: Ref<StudentMonthRow[]>, loading: Ref<boolean>,
  load(): Promise<void>,
  saveRecord(studentId: string, input: { from: Position | null, to: Position | null, pagesMemorized: number, pagesReviewed: number | null, notes: string | null }): Promise<boolean>,
  submit(): Promise<boolean>, approve(): Promise<boolean>, returnWithNote(note: string): Promise<boolean>
}
```
- `saveRecord` ينشئ رأسَ الشهر (`monthly_reports`) إن لم يوجد ثم يُدرج/يُحدّث السجلّ (`upsert` على `(report_id, student_id)`).
- `load()`: الطلابُ النشطون في الحلقة؛ رأسُ الشهر وسجلّاته؛ أيامُ الحلقة وغياباتُها في الشهر؛ آخرُ نهايةٍ سابقة لكلّ طالب (سجلّاتُ الطلاب في تقاريرَ أقدم مرتّبةً بالسنة ثم الشهر تنازلياً — استعلامٌ واحد بـ`in(student_id)` ثم تُختار الأحدث في العميل)؛ ومثلها المعتمَدة؛ والمطلوب = `report.target_pages_snapshot ?? app_settings.target_memorization_pages`.
- **الاختبارات (TDD):** طالبٌ بلا سجلٍّ سابق وquran_parts=0 ← `suggestedFrom=(114,1)`؛ طالبٌ آخرُ نهايته (112,2) ← (112,3)؛ وآخرُ نهايته (112,4) — آخرُ الإخلاص — ← (111,1)؛ التحق في 15 والحلقة انعقدت 20 يوماً منها 10 قبل التحاقه ← `daysHeld=10`؛ غيابان ← `daysAttended=8`؛ مطلوب 35 ← `plan.required = round(35×8/10)=28`؛ لا سجلّ ← `unrecorded`؛ لم يحضر ← `unmeasured`؛ `summarizeOutcomes` وتقريبُ النسبة.
- [ ] TDD ← التنفيذ ← الفحوص ← Commit `feat(quran): بياناتُ الشهر — صفوفُ الطلاب والمطلوبُ المقسَّط والتصنيف`.

---

### Task 7: شاشةُ «الإنجاز القرآني»

**Files:**
- Create: `app/components/quran/MonthPicker.vue`, `OutcomeStrip.vue`, `StudentCard.vue`, `RecordModal.vue`, `ReturnModal.vue`
- Rewrite: `app/pages/reports/index.vue` (≤ 300 سطر)
- Delete: `app/components/reports/HonorsBoard.vue`, `app/composables/useGrades.ts` (بعد `grep` أنّ لا قارئ غير ما يُعدَّل في Task 8)
- Modify: `app/layouts/dashboard.vue` (تسمية `/reports` ← «الإنجاز القرآني»)

**المرجع البصريّ:** لقطةُ المستخدم من الصحابة وملفّاتها: `app/pages/t/quran-progress.vue`، `app/components/teacher/QuranProgressRow.vue`، `app/components/quran/RecordModal.vue` (الحقول 560–660: `USelectMenu` للسورة بـ`ignore-filter` و`filterByLabel`، و`UInputNumber` للآية بحدّ `ayahCount`). **يُنقل السلوك لا الكود كلُّه** (لا قاعدة ولا قراءة ولا تثبيت ولا اتّجاه تصاعديّ).

**الشاشة:**
- رأسٌ: الحلقة (للمعلم ثابتة؛ للمعتمِدين/المديرين/مشرف المشروع `UiSelect` بحلقات نطاقهم، وبلا حلقةٍ مختارة تُعرض قائمةُ حلقاتهم بحالة رصد الشهر: لم يبدأ · مسوّدة · مُرسَل · معتمَد)؛ `MonthPicker` (سهمان + شهر `01..12` وسنة؛ لا شهرَ مستقبليّ)؛ سطرٌ «الشهر MM يُرصَد ابتداءً من DD-MM-YYYY»؛ بحثٌ بالاسم (`arabicFold`).
- `OutcomeStrip`: «اكتمل رصد <الحلقة> — N%» بشريطٍ أخضر، وعدّاداتٌ أربعة (أنجز · مقصّر · لا يُقاس · لم يُرصد) — الضغط على عدّادٍ يُرشّح البطاقات.
- `StudentCard`: الاسم؛ «ثبّت/وصل N من 30 جزءاً» (`juzDone`) أو «خَتم» ؛ شاراتٌ: الصفحات + `monthlyJuzLabel`، «المطلوب X · <التصنيف>»، «حضر a من b»، وحالةُ التقرير؛ زرٌّ «رصد» (بلا سجلّ) / «تعديل» (مسوّدة) / «عرض» (مُرسَل لغير المعتمِد أو معتمَد).
- `RecordModal`: «لم يحفظ جديداً هذا الشهر» (مفتاحٌ يُفرغ المواضع ويجعل الصفحات 0)؛ من سورة/آية (افتراضاً `suggestedFrom`)، إلى سورة/آية؛ الصفحاتُ تُملأ بـ`pagesMemorized` عند كلّ تغيير ويُعدّلها المعلم (0–604)؛ صفحاتُ المراجعة (اختياريّ)؛ ملاحظات. تحقّقٌ في العميل: الترتيبُ (`isInMemorizationOrder`) وحدودُ الآيات — برسائل عربية؛ والحكمُ الأخير للقاعدة (يُعرض خطؤها بـ`useErrorHandler().handle`). قراءةٌ فقط عند «عرض».
- **الأزرار:** المعلم «إرسال للاعتماد» (معطَّلٌ قبل يوم الفتح مع النصّ؛ تأكيدٌ بـ`UiConfirmModal` يذكر عددَ من لم يُرصد) ؛ المعتمِد على المُرسَل: «اعتماد» و«إعادة بملاحظة» (`ReturnModal` بنصٍّ إلزاميّ ≤ 500)؛ على المعتمَد: «إعادة فتح» (`ReturnModal` نفسه). شريطٌ كهرمانيّ للمعلم بنصّ `return_note` حين يعود إليه.
- **تصدير Excel** (اختياريّ بالزرّ القائم `useExport().exportXlsx`): الاسم، من، إلى، الصفحات، المراجعة، حضر/أيام، المطلوب، التصنيف؛ والملف `الإنجاز-القرآني-MM-YYYY`.
- [ ] التنفيذ (كلُّ ملفٍّ ≤ 300 سطر) ← `pnpm lint && pnpm test && pnpm typecheck` ← Commit `feat(quran): شاشةُ الإنجاز القرآني — الرصدُ بالسورة والآية والإرسالُ والاعتماد`.

---

### Task 8: قرّاءُ النموذج القديم

**Files (Modify):**
- `app/components/student/JourneyCard.vue`: يُزال `useGrades`؛ المطلوب من `app_settings.target_memorization_pages` مباشرةً؛ الصفحاتُ المعتمدة: `rpc('my_approved_pages')` لصاحب الحساب، وللموظّف `quran_records(pages_memorized, report:report_id(status))` المعتمَدة. ويُضاف تحتها «سجلُّ الشهور»: لكلّ شهرٍ معتمَد `MM-YYYY · من <سورة آية> إلى <سورة آية> · N صفحة` (للطالب من `my_quran_months()`، وللموظّف من الجدول)، و«وصل N من 30 جزءاً» (`completedJuz` لآخر نهايةٍ معتمَدة).
- `server/api/public/student/[token].get.ts` و`app/pages/s/[token].vue`: الصفحاتُ من `quran_records` المعتمدة، وسجلُّ الشهور نفسه بالخدمة.
- `app/pages/me.vue`: يُحذف تعليقُ «الحضور لاحقاً»؛ وبطاقةُ «حضوري هذا الشهر: حضر a من b» (أيام حلقته من `attendance_days` وغياباتُه من `attendance_absences` — كلاهما مسموحٌ له بالسياسات).
- `app/pages/dashboard.vue`: تُحذف بطاقتا إعداد `default_points` و`default_attendance_days`، وتُسمّى بطاقةُ `target_memorization_pages` «المطلوب الشهريّ (صفحات)».
- `app/pages/metrics/index.vue`: تُحذف معادلاتُ الدرجة والإنجاز والانتظام والنقاط، وتُضاف: «المطلوب المقسَّط بالحضور»، و«التصنيف (أنجز/مقصّر/لا يُقاس/لم يُرصد)»، و«الأجزاءُ بتقسيمة البرنامج».
- `app/pages/index.vue:129`: نصُّ الصفحة الرئيسية بلا «أنشطة» ولا «غياب» يدويّ.
- `app/composables/useNotifications.ts`: طابورُ «رصدُ شهرٍ بانتظار اعتمادك» يبقى (معرّفه معرّفُ التقرير، فتُسقطه `pendingQueue` ما دام إشعارُه غيرَ مقروء).
- `grep -rn "useGrades\|HonorsBoard\|monthly_report_students\|monthly_report_activities\|activities_done\|default_points\|default_attendance_days\|memorization_from" app server` ← **صفر** خارج الأنواع المولّدة.
- [ ] التنفيذ ← الفحوص ← Commit `refactor(quran): قرّاءُ التقرير القديم يقرؤون الرصدَ الجديد — صفحةُ الطالب والرابطُ العامّ واللوحة والمؤشّرات`.

---

### Task 9: التحقّق في المتصفّح والتوثيق

- [ ] **المتصفّح** (المتحكّم يُجريه في المتصفّح المدمج؛ الدخول بحسابٍ تجريبيّ يُدخله المستخدم بنفسه): معلّمُ حلقة النور: الحضور اليوميّ (يومٌ، غائبان) ← الإنجاز القرآني لشهر 10-2026: رصدُ طالبٍ من الناس، حسابُ الصفحات، العدّادات، زرُّ الإرسال معطَّلٌ بنصّ 31-10-2026. ثم (بجلسة SQL للمدير الإداري، أو حسابه إن أدخله المستخدم) اختبارُ اعتماد شهرٍ سابق (09-2026) وإعادتِه، ووصولُ الإشعارات للمعلم. **تُحذف كلُّ البيانات التجريبية التي أنشأتها التجربة بعدها بالمعرّفات.**
- [ ] **التوثيق:** `DATABASE.md` (الجداول والدوالّ والحرّاس والمُنتِجات الجديدة، و`return_note`)، `FEATURES.md` (Changelog 2026-10-19)، `PAGES.md` (`/attendance` و`/reports` الجديدة)، `ROADMAP.md` (الإصدار الثاني: البنود 8–12 ✅، والدفعة الثانية: الجزء ٢ ✅).
- [ ] Commit `docs(quran): توثيقُ الحضور اليوميّ والإنجاز القرآنيّ`.

---

### Task 10: حذفُ النموذج القديم — **بعد نشر Task 1–9 وبإذن المستخدم**

**Files:** Create `supabase/migrations/<v>_drop_old_report_model.sql`; Modify `supabase/tests/v2_rls.sql`, `app/types/database.types.ts`, `docs/DATABASE.md`.

- [ ] بعد تأكّد النشر (تغيّرُ `https://torjoman.org/_nuxt/builds/latest.json`) **وإذن المستخدم صراحةً**: `drop table public.monthly_report_activities, public.monthly_report_students;` · `drop type public.activity_key;` · `alter table public.monthly_reports drop column actual_days, drop column default_days_snapshot, drop column default_points_snapshot, drop column attendance_rate, drop column activities_done, drop column activities_total, drop column general_notes, drop column activities_notes;` · `alter table public.app_settings drop column default_points, drop column default_attendance_days;` — مع فحصٍ ذاتيّ أنّ لا دالّةَ ولا عرضَ يشير إليها (`pg_proc.prosrc` و`pg_views`).
- [ ] تُحدَّث بلوكات `supabase/tests/v2_rls.sql` التي تُدرج `memorization_from/to` لتستعمل `quran_records`، وتُولَّد الأنواع، ويُحدَّث `DATABASE.md`.
- [ ] Commit `refactor(db): حذفُ نموذج التقرير القديم — الأنشطة والنقاط والصفحات الرقمية`.
