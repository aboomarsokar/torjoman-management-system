# سجلُّ الطالب المنقول — المواصفة وخطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** حين يُنقل طالبٌ من حلقةٍ إلى أخرى يرى طاقمُ حلقته الجديدة تاريخَه كلَّه للقراءة (الإنجاز القرآني ونتائج الاختبار ودوراتها)، فتبقى رحلتُه وموضعُ حفظه ودورتُه المستحقّة صحيحة؛ ويُسحب عند النقل ترشيحُه غيرُ المرصود ورصدُه في مسوّدات حلقته القديمة.

**Architecture:** سياساتُ القراءة على `quran_records` و`monthly_reports` و`exam_list_items` و`exam_lists` تُضاف إليها «أو الطالبُ في حلقةٍ أراها الآن» بصيغة `visible_halaqa_ids()`؛ ومُشغِّلٌ بعد تغيير `students.halaqa_id` يسحب الترشيح المعلّق ويحذف رصدَ المسوّدات القديمة؛ وحارسٌ يمنع رصدَ شهرٍ رُصد للطالب وأُرسل في حلقةٍ أخرى. الواجهة تُظهر ذلك الرصدَ للقراءة بعبارة «رُصد في حلقته السابقة».

**Tech Stack:** Nuxt 4 · @nuxt/ui v4 · TypeScript strict · Supabase (RLS، `private`، `security definer`) · Vitest · pnpm.

## قرارات المستخدم (2026-10-20)

1. **ما يُرى:** الطاقمُ الجديد يرى تاريخَ الطالب كلَّه **للقراءة**؛ والقديمُ يبقى يرى ما رصده هو.
2. **الترشيحُ غيرُ المرصود عند النقل:** يُسحب تلقائياً (والقائمةُ إن فرغت)، والنتائجُ المرصودة لا تُمسّ.
3. **شهرُ النقل:** يرصده المعلمُ الجديد كلَّه؛ ورصدُ الطالب في **مسوّدات** حلقته القديمة يُحذف عند النقل. وإن كان القديمُ قد **أرسل** الشهرَ (مُرسَلاً أو معتمَداً) فيبقى، ويظهر عند الجديد للقراءة «رُصد في حلقته السابقة»، ولا يُرصد مرّةً ثانية.

## Global Constraints

- **مكان العمل:** شجرة العمل `/Users/aboomar/Developer/torjoman-v2b2` على `feature/v2-batch2`؛ لا يُلمس `/Users/aboomar/Developer/torjoman`. لا دفع ولا دمج إلا بإذن المستخدم. خادم التطوير حيّ على 3030 من هذه الشجرة: لا `nuxt build` ولا `pnpm typecheck` ولا `nuxt prepare`؛ `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` (الخطأ القائم: `app/pages/students/index.vue` ~235 وحده).
- **صيغةُ السياسات (منذ 2026-10-20):** نطاقُ الحلقة `(x = any ((select public.visible_halaqa_ids())::uuid[]))` لا `can_view_halaqa(x)`، و`(select auth.uid())` لا `auth.uid()`. السياساتُ تُعاد بـ`drop policy … ; create policy …` بالاسم نفسه والأدوار نفسها (`to authenticated`).
- **القاعدة:** دوالُّ المشغّلات في `private`، `security definer`، `set search_path = ''`، بلا EXECUTE لـanon/authenticated؛ حرّاسُ الجداول القائمة قد ترفض حذفاً من داخل مُشغِّل — اقرأها (`guard_graded_item`، حرّاس `quran_records`/`monthly_reports` في هجرات 20261019094547 و095659 و110259) واستعمل `pg_trigger_depth()` كما تفعل؛ كلُّ هجرةٍ تفحص نفسها؛ **اسمُ الملف = النسخةُ المطبَّقة** (من `list_migrations`)؛ التحقّقُ السلوكيّ بأدوارٍ حقيقية في كتلة `do` تنتهي بـ`raise exception 'rollback-ok: …'` **قبل** التطبيق؛ الأنواعُ تُولَّد بعد كلّ هجرة تغيّر `public` (إضافيّاً فقط).
- **الإنتاج:** المشروع `qwtqfkayupzijcoguqrf`. الحساباتُ والحلقاتُ التجريبية أسماؤها تبدأ «تجريبي —» (أربع حلقات: الفرقان، النور، الهدى، الإيمان)؛ لا كتابةَ باقية على الإنتاج إلا الهجرة.
- كلُّ نصٍّ عربيّ، الشهورُ بالأرقام، RTL، لمس ≥ 44px، توكنز لا ألوان، JSDoc عربيّ، ملفّات ≤ 300 سطر. `pnpm lint && pnpm test` خضراء قبل كلّ إيداع؛ رسائلُ Conventional عربية تنتهي بسطرٍ فارغ ثم `Co-Authored-By:` بالنموذج الفعليّ.

---

### Task 1: الهجرة — القراءةُ بحلقة الطالب الحالية، والمُشغِّلُ عند النقل، وحارسُ الشهر المرصود

**Files:** Create `supabase/migrations/<applied-version>_transferred_student.sql`؛ Modify `app/types/database.types.ts` (مولَّد، إن تغيّر).

- [ ] **Step 1: اقرأ الواقع الحيّ** (للقراءة): تعريفاتُ السياسات الأربع الحالية (`pg_policies` لـ`quran_records_read`، `reports_select`، `items_select`، `lists_select`)، وحرّاسُ `quran_records` و`monthly_reports` و`exam_list_items` (`pg_trigger` + `pg_get_functiondef`)، ومُشغِّلاتُ `students` القائمة.

- [ ] **Step 2: السياسات** (كلٌّ بالاسم والأمر والأدوار نفسها، مع إبقاء شرطها الحاليّ حرفياً و`or` الجديد):
  - `quran_records_read`: `… or exists (select 1 from public.students s where s.id = quran_records.student_id and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))`
  - `reports_select` (على `monthly_reports`): `… or exists (select 1 from public.quran_records q join public.students s on s.id = q.student_id where q.report_id = monthly_reports.id and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))` — رأسُ التقرير وحده؛ سجلّاتُ طلابه الآخرين تبقى محجوبة بسياسة السجلّات.
  - `items_select` (على `exam_list_items`): `… or exists (select 1 from public.students s where s.id = exam_list_items.student_id and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))`
  - `lists_select` (على `exam_lists`): `… or exists (select 1 from public.exam_list_items i join public.students s on s.id = i.student_id where i.exam_list_id = exam_lists.id and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]))`
  - لا تُمسّ سياساتُ الكتابة: القراءةُ وحدها تتّسع.

- [ ] **Step 3: المُشغِّل عند النقل** — `private.on_student_transfer()` بعد `update of halaqa_id on public.students` لكلّ صفّ، بشرط `when (old.halaqa_id is distinct from new.halaqa_id and old.halaqa_id is not null)`:
  1. يحذف بنودَ ترشيح الطالب **بلا نتيجة** في قوائم الحلقة القديمة (`exam_list_items i join exam_lists l … where l.halaqa_id = old.halaqa_id and i.student_id = new.id and not exists (select 1 from exam_results r where r.exam_list_item_id = i.id)`)، ثم يحذف قوائمَ الحلقة القديمة التي فرغت بذلك.
  2. يحذف سجلّاتِ الطالب في تقارير الحلقة القديمة **ذات الحالة `draft`** (`quran_records q join monthly_reports r … where r.halaqa_id = old.halaqa_id and r.status = 'draft' and q.student_id = new.id`).
  - إن رفض حارسٌ قائمٌ هذا الحذفَ من داخل المُشغِّل فعدّل الحارسَ (بإعادة تعريفه كما هو مع استثناء `pg_trigger_depth() > 1`) في الهجرة نفسها، ووثّق ذلك في التقرير.
  - لا إشعار.

- [ ] **Step 4: حارسُ الشهر المرصود** — `private.guard_month_recorded_elsewhere()` قبل `insert` على `quran_records` (ولـ`update of student_id, report_id`): يرفض إن وُجد للطالب نفسه سجلٌّ في تقريرٍ **آخر** للشهر والسنة نفسيهما حالتُه ليست `draft`، برسالة «رُصد هذا الشهرُ للطالب في حلقته السابقة.» و`errcode = '23514'`.

- [ ] **Step 5: فحصٌ ذاتيّ** — السياساتُ الأربع تحوي `visible_halaqa_ids` وصيغة `students`؛ المُشغِّلان موجودان؛ الدوالُّ بلا EXECUTE لـauthenticated/anon.

- [ ] **Step 6: تحقّقٌ سلوكيّ قبل التطبيق (معاملةٌ تُلغى)** — كتلة `do` واحدة تُنفّذ نصَّ الهجرة بـ`execute` ثم الحالات، بأدوارٍ حقيقية (`set_config('role','authenticated',true)` + `request.jwt.claims`، والعودة إلى `postgres` قبل القراءات التحقّقية):
  - جهّز: طالبٌ تجريبيّ في «تجريبي — حلقة الفرقان» له تقريرٌ **معتمَد** لشهر 9-2026 فيه سجلٌّ، وتقريرٌ **مسوّدة** لشهر 10-2026 فيه سجلّ، وترشيحٌ **مرصود** لدورةٍ وترشيحٌ آخر **معلّق** (أنشئها كـpostgres بقيمٍ صالحةٍ للقيود؛ أو استعمل `session_replication_role` إن اعترضت الحرّاسُ التجهيز ثم أعِده).
  - انقله إلى «تجريبي — حلقة النور» (تحديث `halaqa_id` بصفة المدير الإداري).
  - تحقّق: معلّمُ النور يرى سجلَّ 9-2026 ورأسَ تقريره، ويرى البندَ المرصود ونتيجتَه؛ ولا يرى سجلّاتِ طلاب الفرقان الآخرين؛ ومعلّمُ الفرقان ما زال يرى سجلَّ 9-2026 (كتبه هو)؛ والبندُ المعلّق حُذف وقائمتُه إن فرغت؛ وسجلُّ مسوّدة 10-2026 حُذف؛ والنتيجةُ المرصودة باقية؛ ومعلّمُ النور يُدرج سجلّاً لشهر 9-2026 في تقريرٍ لحلقته ← رفض «رُصد هذا الشهرُ…»؛ ويُدرج لشهر 10-2026 ← ينجح.
  - اكتب الناتجَ حرفياً في التقرير.

- [ ] **Step 7:** طبّق بـ`apply_migration` (الاسم `transferred_student`)، وسمِّ الملفَّ بالنسخة من `list_migrations`؛ ولّد الأنواع إن تغيّرت (`generate_typescript_types` ← `python3 -I -c` إلى المسوّدة ← `diff` إضافيّ ← استبدال).

- [ ] **Step 8:** `pnpm lint && pnpm test`؛ vue-tsc. Commit `feat(db): الطاقمُ الجديد يرى تاريخَ الطالب المنقول، والنقلُ يسحب المعلّقَ والمسوّدة`.

---

### Task 2: الواجهة — «رُصد في حلقته السابقة»

**Files:** Modify `app/composables/useQuranMonth.ts`, `app/utils/quran/month.ts` (+ `app/composables/useQuranMonth.test.ts`), `app/components/quran/StudentCard.vue` (وما يلزم من `app/utils/quran/screen.ts`).

- [ ] **Step 1: الاستعلام** — في `useQuranMonth` بعد معرفة `ids`: سجلّاتُ هؤلاء الطلاب للشهر نفسه في تقارير **حلقاتٍ أخرى** غيرِ المسوّدة:
  `supabase.from('quran_records').select('*, report:monthly_reports!inner(halaqa_id, report_year, report_month, status)').in('student_id', ids).eq('report.report_year', y).eq('report.report_month', m).neq('report.halaqa_id', hid).neq('report.status', 'draft')` — ضمن `Promise.all` القائم.
- [ ] **Step 2: المنطق النقيّ** — `BuildRowsInput` يأخذ `elsewhereRecords?: QuranRecordRow[]`؛ وفي `buildStudentRows`: إن لم يكن للطالب سجلٌّ في تقرير الحلقة ووُجد له سجلٌّ في `elsewhereRecords` ← `record` هو ذاك، و`recordedElsewhere: true` (حقلٌ جديد في `StudentMonthRow`، افتراضه `false`)، والتصنيفُ يُحسب منه كالعادة. اختبارات: بلا سجلّ ← `recordedElsewhere` false؛ سجلٌّ في الخارج ← الصفّ يحمله و`recordedElsewhere` true والتصنيف من صفحاته؛ سجلٌّ في الحلقة وفي الخارج ← سجلُّ الحلقة يغلب.
- [ ] **Step 3: البطاقة** — `StudentCard.vue`: إن `row.recordedElsewhere` ← شارةٌ «رُصد في حلقته السابقة» بلون محايد، وزرُّ الرصد/التعديل يختفي (لا تعديلَ ولا حذف)، ويبقى عرضُ الموضع والصفحات. وتصديرُ Excel (`exportRows` في `screen.ts`) يذكر ذلك في الملاحظات إن كان فيها عمود ملاحظات.
- [ ] **Step 4:** `pnpm lint && pnpm test`؛ vue-tsc؛ لا تعريفَ مكرّر في SFC. Commit `feat(quran): رصدُ شهر النقل المُرسَل في الحلقة السابقة يظهر للقراءة`.

---

### Task 3: التحقّق في المتصفّح والتوثيق (المتحكّم)

- [ ] نقلُ طالبٍ تجريبيّ بين حلقتين تجريبيتين بحساب المدير الإداري (بإذن المستخدم، مع إرجاعه بعد التجربة وحذف ما يُنشأ بالمعرّفات بإذنه)؛ معلّمُ الحلقة الجديدة يرى رحلتَه ودورتَه المستحقّة الصحيحة وموضعَ البداية المقترح من آخر موضعٍ له.
- [ ] التوثيق: `docs/DATABASE.md` (السياسات الأربع، المُشغِّلان)، `docs/FEATURES.md` (Changelog 2026-10-20)، `docs/PAGES.md` (الإنجاز القرآني)، ووثيقة السيناريوهات (حالةُ نقلٍ عند المشرف أو المدير).
- [ ] Commit `docs: سجلُّ الطالب المنقول`.
