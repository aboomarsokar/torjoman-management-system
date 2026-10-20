# مخطط قاعدة البيانات — ترجمان القرآني

> **الحالة (2026-10-19):** يطابق الهجرات حتى `20261019145800_drop_exam_plan` — أساس الإصدار الثاني: ثمانية أدوار، النطاق في الدور (لا عمود `section`)، دخولٌ بالرقم الوظيفي/الهوية، حساب لكل طالب، صورة شخصية، وإشعاراتُ الأحداث داخل المنصّة (§18)، ومراجعُ المصحف (§19)، والحضورُ اليوميّ بالاستثناء (§20)، والرصدُ القرآنيّ الشهريّ ومسارُ اعتماد المشرف (§21)، والاختبارات المرحلية `exam_cycles` (§22 — الهجرات `20261019121528` و`20261019122626` و`20261019142657`، ثم `20261019145800_drop_exam_plan` التي حذفت الخطةَ القديمة `exam_plan` وكلَّ ما يتبعها وجعلت `exam_cycle_id` إلزامياً). قراءة الأقسام بالترتيب: §1 `profiles` ← §2 `students` ← §17 الأدوار ودوالّ النطاق والحرّاس والمستودعات ← §18 الإشعارات ← §19 مراجع المصحف ← §20 الحضور اليوميّ ← §21 الرصد القرآنيّ الشهريّ ← §22 الاختبارات المرحلية.
> هذا الملف **مصدر الحقيقة** لبنية القاعدة، ويطابق آخر migration دائماً.
> أي تغيير = migration جديد + تحديث هذا الملف + إعادة توليد الأنواع.

**القرارات العامة:**
- جميع المفاتيح الأساسية `uuid` (افتراضي `gen_random_uuid()`).
- جميع الجداول فيها `created_at` و `updated_at` (`timestamptz`).
- **RLS مُفعّل على كل جدول** — السياسات موضّحة أسفل كل جدول.
- العملة المالية: الشيكل (₪).
- التواريخ: ميلادي افتراضياً.
- **العمر لا يُخزّن** — يُحسب من تاريخ الميلاد عند العرض.

---

## نظرة عامة على العلاقات

```
auth.users (Supabase)  ← كل الحسابات: الموظفون (بريد داخلي @staff.torjoman.org) والطلاب (@students.torjoman.org)
    │ 1:1
    ▼
profiles ──────┐ (assigned_by self-reference — «عيّنه»)
    │
    ├─< halaqat (teacher_id, supervisor_id, examiner_id)   حلقة: معلم + مشرف ميداني + مختبِر
    │       │
    │       ├─< students (halaqa_id)           سجلّ الطالب — مربوط بحسابه بـ students.user_id (→ auth.users ← profiles بدور student)
    │       ├─< supervision_visits (halaqa_id) زيارات الحلقة
    │       ├─< monthly_reports (halaqa_id)    رأسُ رصد الحلقة الشهريّ ← quran_records (report_id, student_id) (§21)
    │       ├─< halaqa_incentives (halaqa_id)  تخصيص حوافز الحلقة الشهري (المدير الإداري)
    │       └─< incentive_statements (halaqa_id) كشف حوافز الحلقة (المعلم)
    │
    ├─< exam_lists (teacher_id)                قوائم الاختبار الأسبوعي
    │       └─< exam_list_items (exam_list_id, student_id, exam_cycle_id → exam_cycles)   بندُ الترشيح
    │               └── exam_results (exam_list_item_id، نتيجةٌ واحدة لكلّ بند)
    │
    ├─< admin_alerts (issuer_id, teacher_id)   التنبيهات الإدارية
    ├─< notifications (recipient_id)           إشعارات الأحداث — تكتبها مُشغّلات، ويقرؤها صاحبها وحده (§18)
    ├─< meeting_minutes (created_by)           محاضر الاجتماعات
    ├─< monthly_salaries (profile_id)          الرواتب الشهرية المرجعية (المدير الإداري)
    └─< financial_transactions (created_by)    الحركات المالية

exam_cycles (بيانات مرجعية: 15 دورةً — يعدّلها المدير الإداري والمدير الفني، §22)
app_settings (إعدادات المدير الإداري القابلة للضبط)
news (الأخبار — المدير الإداري ينشرها، عامّة على Landing)
```

---

## 1. `profiles` — الحسابات (الموظفون والطلاب)

يمتدّ من `auth.users`. صفّ لكل حساب: الموظفون بكل أدوارهم، وللطالب صفٌّ بدور `student` (بياناته الدراسية في `students` §2، ويُربطان بـ`students.user_id = profiles.id`). حسابٌ جديد لا يُنشأ إلا من خادم التطبيق بصلاحية الخدمة (المدير الإداري وحده — §17).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `role` | enum `user_role` | ثمانية: `project_supervisor` / `admin_manager` / `technical_manager` / `women_admin` / `field_supervisor` / `examiner` / `teacher` / `student` — المعاني والنطاق في §17. (القديم: `manager`→`admin_manager` و`quality`→`technical_manager` و`supervisor`→`field_supervisor`، وأُلغي النوع القديم بهجرة 20261017132335.) |
| `employee_number` | text unique | **الرقم الوظيفي** — 4 خانات بالضبط (`check ^\d{4}$`)، يبدأ من `1001`، يولّده `claim_employee_number()` من تسلسلٍ للخدمة وحدها عند إنشاء الحساب. للموظفين فقط (null للطالب). معرّف دخول الموظف؛ بريده الداخلي `<رقم>@staff.torjoman.org` |
| `must_change_password` | boolean | يرتفع عند الإنشاء بالكلمة المؤقّتة أو إعادة التعيين (وما دام قائماً فلا شاشة إلا `/change-password`)؛ يطفئه صاحبه بعد تغييرها، ولا يرفعه إلا المدير الإداري أو الخدمة (`guard_profile_privileged`) |
| `full_name` | text | الاسم رباعي |
| `gender` | enum | `male` / `female` |
| `birth_date` | date | العمر يُحسب منه |
| `national_id` | text unique | رقم الهوية (مقنّع للعرض) |
| `marital_status` | text | الحالة الاجتماعية |
| `family_count` | int | عدد الأفراد |
| `job_title` | text | المسمى الوظيفي |
| `hire_date` | date | تاريخ التعيين |
| `years_experience` | int | سنوات الخبرة |
| `residence_area` | text | المنطقة/المدينة |
| `nearest_mosque` | text | أقرب مسجد |
| `address_detail` | text | عنوان السكن التفصيلي |
| `education_level` | text | المؤهل التعليمي |
| `academic_major` | text | التخصص الأكاديمي |
| `quran_parts` | int | عدد الأجزاء المثبتة |
| `tajweed_level` | text | الأحكام (التجويد) |
| `phone` | text | رقم الجوال |
| `email` | text | اختياري، للتواصل لا للدخول (البريد الداخلي في Auth لا هنا) |
| `status` | enum | `pending` / `active` / `disabled` — الحساب غير النشط لا يُعيد `current_user_role()` شيئاً فيفقد كل نطاقه ويرى صفّه وحده |
| `assigned_by` | uuid FK → profiles | «عيّنه» — مَن أنشأ/عيّن هذا الحساب |
| `avatar_url` | text | ⚠️ متروك منذ Task 6b (لا يُقرأ ولا يُكتب) — يُسقط بعد النشر |
| `photo_path` | text | الصورة الشخصية الاختيارية: مسارٌ في المستودع **الخاص** `profile-photos`، شكلُه ثابت `<id>/photo.webp` (قيد `profiles_photo_path_shape`)، و**لا صورة لحساب أنثى**. القراءة بروابط موقَّعة لساعة: لصاحبها ولكل حسابٍ نشطٍ غير طالب (`can_view_profile_photo`)؛ الرفع/الحذف لصاحب المجلّد أو المدير الإداري (`can_manage_profile_photo`). الهجرة `20261018080234_profile_photos.sql`. ومنذ `20261018081904_profile_photos_gender_sync.sql`: جنسُ الطالب يُزامَن من `students` إلى حسابه (`students_sync_gender_to_profile_*`)، وتحويلُ الحساب إلى أنثى يُفرغ `photo_path` آلياً (`profiles_photo_clear_on_female`)، والقراءةُ لغير صاحبها والمدير تشترط `photo_path` غيرَ فارغ (فالكائن اليتيم لا يُوقَّع) |

**بيانات مالية (🔒 جدول منفصل `profile_financials` بـ RLS صارم: كتابة المدير الإداري وحده، وقراءة المدير الإداري ومشرف المشروع):**

| العمود | النوع | ملاحظات |
|---|---|---|
| `profile_id` | uuid FK → profiles | |
| `account_number` | text | رقم الحساب/المحفظة (يقبل رقم جوال) |
| `account_holder` | text | اسم صاحب الحساب |
| `account_type` | enum | `jawwalpay` / `palpay` / `bank_palestine` |

**RLS** (`profiles_*` — هجرة `v2_hardening`):
- **القراءة:** كل حسابٍ نشط غير طالب يقرأ كل الصفوف (الأسماء يحتاجها الجميع)؛ الطالب يقرأ صفّه وحده؛ الحساب غير النشط صفّه وحده.
- **الإدراج:** `admin_manager` فقط (والخدمة عبر `/api/users` و`/api/students`).
- **التعديل:** `admin_manager` أو صاحب الصفّ. والأعمدة الامتيازية يحرسها `guard_profile_privileged` (§17): الدور والحالة والرقم الوظيفي والجنس للمدير الإداري وحده، والمستخدم يعدّل بقيّة بياناته.
- **الحذف:** `admin_manager` فقط.
- البيانات المالية للعاملين (`profile_financials`): قراءة `admin_manager` و`project_supervisor`، وكتابة `admin_manager` فقط.

---

## 2. `students` — الطلاب

**سجلّ الطالب الدراسي — وله حساب دخول.** منفصل عن `profiles` (الذي فيه صفّ الحساب بدور `student`) ويرتبط به عبر `user_id`. **يُضيفه المدير الإداري وحده** عبر `POST /api/students` الذي ينشئ في الخطوة نفسها حساب Auth (`<هوية>@students.torjoman.org`) وصفّ `profiles` وهذا الصفّ، ويتراجع عن الكل إن فشلت خطوة. يُعدَّل ويُدار من العاملين بنطاقهم (§17)، ومرتبط بحلقة.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid unique FK → auth.users | **حساب الطالب** (`on delete set null`)؛ يُكتب عند الإنشاء ولا يغيّره إلا المدير الإداري/الخدمة. `my_student_id()` و`my_halaqa_id()` يقرآن منه |
| `full_name` | text | الاسم رباعي |
| `gender` | enum | `male` / `female` |
| `birth_date` | date | العمر يُحسب منه |
| `national_id` | text unique | رقم الهوية — 9 خانات، **معرّف دخول الطالب** (فريد، مقنّع للعرض لغير المخوّل). يغيّره المدير الإداري وحده |
| `family_count` | int | عدد الأفراد |
| `quran_parts` | int | عدد الأجزاء المثبتة |
| `tajweed_level` | text | الأحكام (التجويد) |
| `residence` | text | السكن الحالي |
| `nearest_mosque` | text | أقرب مسجد |
| `enrollment_date` | date | تاريخ الالتحاق |
| `status` | enum | `active` / `withdrawn` / `graduated` / `transferred` |
| `guardian_name` | text | اسم ولي الأمر |
| `guardian_phone` | text | جوال ولي الأمر |
| `guardian_email` | text | بريد ولي الأمر — **للإشعار فقط (اختياري)، لا للاستعادة** |
| `phone` | text | رقم الجوال |
| `halaqa_id` | uuid FK → halaqat | الحلقة الحالية |
| `created_by` | uuid FK → profiles | المعلم الذي أدخل سجلّ الطالب |
| `view_token` | text | رمز رابط الاطّلاع العام `/s/[token]` (يعيد توليده المدير الإداري وحده) |
| `avatar_url` | text | ⚠️ متروك منذ Task 6b — الصورة الشخصية صارت في `profiles.photo_path` (§1) — يُسقط بعد النشر |

> **الجنس:** تعديل `students.gender` يُزامَن آلياً إلى `profiles.gender` لحساب الطالب (`students_sync_gender_to_profile_ins/_upd`، هجرة `…081904`)، فلا يتباعد الموضعان (مدارُ قيد الصورة).

**RLS** (`students_*`):
- **القراءة:** الطالب صفّه (`user_id = auth.uid()`)؛ كل من يرى حلقته (`can_view_halaqa(halaqa_id)`)؛ و**غير المُسنَد** (`halaqa_id is null`): مشرف المشروع، والمديران، والمديرة للبنات، والمشرف الميداني لمن جنسُه كجنسه.
- **الإدراج والحذف:** `admin_manager` فقط.
- **التعديل:** `admin_manager`؛ ومن يملك الإسناد في الحلقة (`can_assign_in_halaqa`) أو معلّمها؛ وفي غير المُسنَد: المديران والمديرة (البنات) والمشرف الميداني. والحارس `guard_student_assignment` (§17) يضبط ما لا تضبطه السياسة: الهوية/الجنس/الحساب/الرمز للمدير الإداري وحده، والإسناد والإخراج بالصلاحية وتطابق الجنس.

> **نقل طالب:** عند تغيير `halaqa_id` يُحفظ السجلّ الكامل (الاختبارات/الحفظ/الغياب)، وتُحدَّث حالته في الحلقة السابقة إلى `transferred`. **جنس الطالب يطابق جنس الحلقة** — حارس القاعدة يرفض غير ذلك (`23514`)، وخادم `/api/students` يفحصه قبل إنشاء الحساب.

---

## 3. `halaqat` — الحلقات

الكيان المحوري: معلم + طلاب + وقت يومي ثابت.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | اسم الحلقة |
| `daily_time` | time | الوقت اليومي الثابت |
| `teacher_id` | uuid FK → profiles | **إلزامي** — لا حلقة بلا معلم |
| `supervisor_id` | uuid FK → profiles | المشرف الميداني المسؤول (اختياري — قد تكون «غير مُسندة») |
| `classification` | enum | `a` / `b` (تصنيف إداري) |
| `gender` | enum | `male` / `female` |
| `status` | enum | `active` / `stopped` |
| `assigned_by` | uuid FK → profiles | «عيّنه» — مَن أسند المشرف |
| `examiner_id` | uuid FK → profiles | المختبِر الذي يرصد اختبارات الحلقة (اختياري؛ مُشغِّل يرفض غير `examiner`) |
| `examiner_assigned_by` | uuid FK → profiles | مَن أسند المختبِر — يملؤه مُشغِّل `stamp_halaqa_examiner` |
| `examiner_assigned_at` | timestamptz | متى أُسند |

> **جنس الحلقة هو حدّ قسم البنات:** `halaqat.gender = 'female'` ← نطاق `women_admin`. لا مشرف جودة ولا ربط بالمحافظة (مؤجَّل — ROADMAP #31).

**RLS** (`halaqat_*`):
- **القراءة:** `can_view_halaqa(id)` — مشرف المشروع والمديران (كل الحلقات)، والمديرة (حلقات البنات)، ومن أُسند إليها (مشرفاً أو مختبِراً أو معلّماً) بحسابٍ نشط؛ والطالب حلقته (`id = my_halaqa_id()`).
- **الإنشاء والتعديل:** `admin_manager` و`technical_manager` (`can_manage_halaqa`). **الحذف:** `admin_manager` وحده. المديرة لا تنشئ ولا تعدّل ولا تحذف.

---

## 4. `supervision_visits` — الزيارات الإشرافية

جدولة المشرف لزياراته الشهرية + نتائجها.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `halaqa_id` | uuid FK → halaqat | الحلقة المُزارة |
| `supervisor_id` | uuid FK → profiles | المشرف المنفِّذ |
| `scheduled_at` | timestamptz | الموعد المجدول |
| `executed_at` | timestamptz | يومُ التنفيذ الفعلي يختاره المشرف (يُخزَّن ظهرَ اليوم بغرينتش فلا ينقلب يومُه في غزة) — لا يتجاوز اليوم |
| `status` | enum | **تشتقّه القاعدة** (المشغِّل `supervision_visits_derive_status`، هجرة `20261019125332`): بلا تنفيذ `scheduled`، ونُفّذت في يوم موعدها أو قبله بتوقيت غزة `done`، وبعده `late`. و`missed` **لا يُخزَّن**: يُشتقّ عند العرض لمجدولةٍ فات يومُها (`app/utils/visitStatus.ts`) |
| `notes` | text | ملاحظات الزيارة |
| `flow_rating` | text | تقييم سير الحلقة |
| `strengths` | text | نقاط القوة |
| `improvements` | text | نقاط التحسين |
| `recommendations` | text | توصيات |

**جدول فرعي `visit_reschedule_log` (تغييرات المواعيد):**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `visit_id` | uuid FK → supervision_visits | |
| `old_time` | timestamptz | الموعد القديم |
| `new_time` | timestamptz | الموعد الجديد |
| `reason` | text | **سبب التغيير (إلزامي)** |
| `changed_at` | timestamptz | |

> **مؤشر الالتزام:** الالتزام = (في وقتها) ÷ (المستحقّة: تمّت + متأخّرة + فائتة) × 100 — دالّةٌ واحدة `visitCommitment` تستعملها شاشات الزيارات والمشرفين.

> **تعديلُ الموعد بسببٍ إلزاميّ** (قرار 2026-10-19، هجرة `20261019125332`): الدالّة `reschedule_visit(p_visit, p_new_time, p_reason)` (`security invoker`، فتسري RLS) ترفض السبب الأقصر من 3 أحرف والزيارةَ المنفَّذة والموعدَ نفسه، وتكتب سطر `visit_reschedule_log` ثم الموعد في معاملةٍ واحدة. والحارس `supervision_visits_guard_reschedule` ← `guard_visit_reschedule` يرفض أيَّ تغييرٍ لـ`scheduled_at` بلا سطر سجلٍّ في المعاملة نفسها (`changed_at = now()`). السجلُّ يقرؤه كلُّ من يقرأ الحلقة، وتعرضه نافذة نتيجة الزيارة.

**RLS** (`visits_*` و`reschedule_*`):
- **القراءة:** `can_view_halaqa(halaqa_id)` (فالمديرة تقرأ زيارات البنات بلا كتابة).
- **الإدراج:** `can_manage_halaqa` (المديران)، أو المشرف الميداني **المسؤول عن تلك الحلقة** (`supervisor_id = auth.uid()` و`is_halaqa_supervisor`).
- **التعديل:** صاحب الزيارة (`supervisor_id`) أو المديران؛ و`with check` يعيد فحص الحلقة الجديدة فلا تُنقل زيارةٌ إلى حلقةٍ خارج نطاقه. **الحذف:** المديران.

---

## 5. `exam_plan` — حُذف 2026-10-19 (هجرة 20261019145800)

> حُذف جدولُ `exam_plan` (خطة المجموعات الست) ونوعُه `exam_stage_type` بالهجرة `20261019145800_drop_exam_plan` بعد أن حلّ محلّه `exam_cycles` (15 دورةً بثلاث مراحل — §22). لا تُعاد قراءةُ مواصفاته من هنا؛ المرجع الوحيد الآن §22.

---

## 6. `exam_lists` — قوائم الاختبار الأسبوعي

المعلم يرشّح طلاباً → تصل لمختبِر الحلقة (`halaqat.examiner_id`). المستلم يُشتقّ من الحلقة لحظة القراءة ولا يُخزَّن في القائمة، فإعادة الإسناد تنقل المعلّق معها.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `teacher_id` | uuid FK → profiles | المعلم المُرشِّح |
| `halaqa_id` | uuid FK → halaqat | |
| `week_date` | date | تاريخ الأسبوع |
| `status` | enum | `sent` / `in_progress` / `completed` |

**`exam_list_items` — الطلاب المرشّحون في القائمة:**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `exam_list_id` | uuid FK → exam_lists | |
| `student_id` | uuid FK → students | |
| `exam_cycle_id` | smallint **NOT NULL** FK → exam_cycles (`on delete restrict`) | **الدورة المرشَّح لها** (منذ `20261019121528`؛ إلزاميٌّ منذ `20261019145800`) — فهرس `idx_exam_list_items_cycle`، وفهرس `idx_exam_list_items_student` على الطالب |
| `teacher_note` | text | ملاحظة اختيارية |

> حُذف 2026-10-19 (هجرة 20261019145800) العمودُ القديم `exam_plan_id` (النطاق في الخطة السابقة)؛ فكلُّ بندٍ الآن بدورة.

**RLS** (`lists_*` و`items_*`):
- **القراءة:** `can_view_halaqa(halaqa_id)` لكل من يرى الحلقة (البنود عبر قائمتها).
- **إنشاء القائمة:** المعلم لحلقته فقط (`teacher_id = auth.uid()` و`is_halaqa_teacher`).
- **تحديث القائمة (الحالة):** المديران أو مختبِر الحلقة. **حذفها:** المديران أو المعلم صاحبها.
- **البنود:** يكتبها معلّم الحلقة أو المديران (`can_manage_halaqa`).
- **حرّاس البنود (لكل كاتب، §22):** `guard_cycle_sequence` يفرض الدورةَ المستحقّة ويمنع ترشيحاً ثانياً قبل رصد الأول، و`guard_graded_item` يمنع حذفَ ترشيحٍ رُصدت نتيجته أو نقلَه. فسحبُ الترشيح (حذفُ البند) متاحٌ للمعلّم والمديرَين **قبل الرصد وحده**، وحذفُ حلقةٍ لها ترشيحاتٌ مرصودة مرفوض.

---

## 7. `exam_results` — نتائج اختبار الطالب

المختبِر يُدخل النتيجة (منذ 2026-10-15؛ قبلها المشرف). المجموع الأعلى **99** (تسعُ خاناتٍ من 10 + التجويد حتى 9 — `EXAM_MAX_TOTAL` في `app/constants/exams.ts`). عند الاجتياز يرفع مُشغِّل `bump_parts_on_pass` قيمة `students.quran_parts` إلى عدد أجزاء الدورة المحقَّق من الناس = `31 − exam_cycles.parts_from` (لا يُنقِصها أبداً) — التفصيل في §22. الاجتياز عند علامة قابلة للضبط (افتراضي 80%).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `exam_list_item_id` | uuid FK → exam_list_items | **فريد** (`uq_exam_results_item` منذ `20261019122626`): نتيجةٌ واحدة لكلّ ترشيح، ومحاولةٌ جديدة بعد الرسوب ترشيحٌ جديد. ولا تُنقل النتيجة إلى ترشيحٍ أو طالبٍ آخر (`guard_result_link`) |
| `student_id` | uuid FK → students | |
| `examiner_id` | uuid FK → profiles | الراصد (المختبِر؛ النتائج القديمة باسم المشرف) |
| `exam_date` | date | تاريخ الاختبار |
| `q1_memorization` | int | س1 حفظ (0–10) |
| `q1_understanding` | int | س1 فهم (0–10) |
| `q1_reflection` | int | س1 تدبر (0–10) |
| `q2_memorization` | int | س2 حفظ (0–10) |
| `q2_understanding` | int | س2 فهم (0–10) |
| `q2_reflection` | int | س2 تدبر (0–10) |
| `q3_memorization` | int | س3 حفظ (0–10) |
| `q3_understanding` | int | س3 فهم (0–10) |
| `q3_reflection` | int | س3 تدبر (0–10) |
| `tajweed_score` | int | الأحكام (**7–9**، قيد `exam_results_tajweed_score_check` منذ هجرة `20261019084101`، ومُفعَّل على القديم أيضاً منذ `20261019091015`) — مرة واحدة |
| `total_score` | int | يُحسب آلياً (المجموع من 99) |
| `pass_mark_snapshot` | int | علامة الاجتياز وقت الاعتماد (لا يُعاد احتسابها). **تضعها القاعدة** (`exam_results_guard_pass_mark`): عند الإدراج من `app_settings.pass_mark` مهما أرسل العميل، وعند التعديل لا تتغيّر |
| `passed` | boolean | مجاز/غير مجاز (محسوب) |
| `notes` | text | ملاحظات |

> الأوزان (10×9 + التجويد حتى 9) قابلة للضبط مستقبلاً كقيم ثابتة. **علامة الاجتياز تُخزّن snapshot** لكل نتيجة — تغييرها يسري على اللاحق فقط.

**RLS** (`results_*`):
- **القراءة:** الطالب نتائجه (`student_id = my_student_id()`)، ومن يرى حلقة الطالب (`can_view_halaqa`) — المشرف الميداني والمعلم قارئان.
- **الإدراج:** المديران، أو المختبِر لطلاب حلقاته باسمه (`examiner_id = auth.uid()` و`is_halaqa_examiner`).
- **التعديل:** الراصد نفسه أو المديران؛ و`with check` يعيد فحص النطاق على الطالب الجديد فلا تُحوَّل نتيجةٌ إلى طالبٍ خارج حلقات المختبِر. **الحذف:** `admin_manager` وحده.
- ⚠️ سياستا `exam_list_items`/`monthly_reports` لا يجتازهما الطالب (`can_view_halaqa`)، فتضمينُهما يصله `null` — لذلك تقرأ رحلته بالدوالّ `my_exam_cycle_results()` و`my_approved_pages()` و`my_quran_months()` (§17، §22) — و`my_exam_results()` القديمة حُذفت 2026-10-19 (هجرة 20261019145800).
- **إشعار الرصد:** كلُّ نتيجةٍ جديدة تُصدر `exam_graded` لمعلّم الحلقة وللطالب (§22).

---

## 8. `monthly_reports` — التقرير الشهري للحلقة

> **النموذج القديم مُلغى ومحذوف (2026-10-19، الهجرة `20261019111920_drop_old_report_model`):** الرصدُ الشهريّ صار بالسورة والآية في `quran_records` ومسارُه ومعتمِدُه في **§21**، والحضورُ يومياً في `attendance_days`. حُذفت الأنشطةُ والنقاطُ والدرجاتُ وأيامُ الدوام اليدوية: الجدولان `monthly_report_students` و`monthly_report_activities` (وسياساتُهما `rstudents_*` و`ractivities_*`)، والنوع `activity_key`، وأعمدةُ `monthly_reports` (`actual_days` و`default_days_snapshot` و`default_points_snapshot` و`attendance_rate` و`activities_done` و`activities_total` و`general_notes` و`activities_notes`)، وعمودا `app_settings` (`default_points` و`default_attendance_days`). كانت كلُّها فارغةً (0 صف) ولم يبقَ لها قارئٌ في الشيفرة ولا في الدوالّ والعروض.

`monthly_reports` هو رأسُ الرصد الشهريّ للحلقة (الحالةُ والأختام)، وسجلُّ كلّ طالبٍ فيه هو `quran_records` (§21).

**مستوى التقرير (الباقي بعد الحذف):**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `halaqa_id` | uuid FK → halaqat | |
| `report_month` | int | الشهر |
| `report_year` | int | السنة |
| `submitted_at` | date | تاريخ التسليم (للتدقيق) |
| `target_pages_snapshot` | int | صفحات الحفظ المستهدفة شهرياً (من إعدادات المدير، للقراءة) |
| `status` | enum | `draft` / `submitted` / `approved` |
| `approved_by` | uuid FK → profiles | مَن اعتمد التقرير (للتدقيق) |
| `approved_at` | timestamptz | تاريخ الاعتماد (مستقل عن شهر التقرير) |
| `return_note` | text | ملاحظة الإعادة إلى المسوّدة (إلزامية عند الإعادة، §21) |
| `created_at` / `updated_at` | timestamptz | |

> **قيود إلزامية (§4.17):** (١) **تفرّد** — `UNIQUE (halaqa_id, report_month, report_year)`: تقرير واحد لكل حلقة لكل شهر. (٢) **منع الأشهر المستقبلية** — تحقّق (`CHECK`/خادمي) يمنع إنشاء تقرير لشهر لم يبدأ. (٣) الشهر يُقفل بعد التسليم.

**RLS** (`reports_*`) — **منذ `20261019094547` تكتب `reports_write` بـ`can_approve_report_in_halaqa` لا `can_approve_in_halaqa` (§21):**
- **القراءة:** `can_view_halaqa(halaqa_id)`؛ والطالب يقرأ صفحاته المعتمدة عبر `my_approved_pages()` (§21).
- **الكتابة:** معلّم الحلقة أو معتمِدُ الرصد في الحلقة (`can_approve_report_in_halaqa`: المشرف الميداني لها، والمدير الإداري، والمديرة لحلقات البنات — **لا المدير الفني**). سجلّات الطلاب في `quran_records` (§21).
- **الحارس `guard_report_status`** (§17، §21): المعلم ينقل `draft→submitted` ويعدّل ما دام مسودّة؛ `approved` وحقول `approved_by/at` لمعتمِد الحلقة وحده؛ وبعد الإرسال لا تعديل إلا بيد المعتمِد، ولا حذف إلا بيد المدير الإداري.

---

## 9. `meeting_minutes` — محاضر الاجتماعات الإدارية

🔒 المدير الإداري (إنشاء وتعديل)، ومشرف المشروع اطّلاعاً.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | العنوان/الموضوع |
| `meeting_date` | date | التاريخ |
| `attendee_ids` | uuid[] | الحاضرون — اختيار من العاملين المؤهّلين (مشرف المشروع والمديران والمديرة الإدارية والمشرفون الميدانيون) فقط، لا إدخال حرّ (§4.19) |
| `agenda` | text | جدول الأعمال/البنود |
| `decisions` | text | القرارات المتّخذة |
| `tasks` | text | المهام والمسؤوليات (اختياري) |
| `attachments` | jsonb | مرفقات (اختياري) |
| `status` | enum | `draft` / `final` |
| `created_by` | uuid FK → profiles | |

**RLS** (`minutes_all`): الكتابة `admin_manager` فقط، والقراءة `admin_manager` و`project_supervisor`.

---

## 10. `financial_transactions` — الحركات المالية

🔒 المدير الإداري (كتابة) ومشرف المشروع (قراءة). بالشيكل (₪).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `transaction_date` | date | التاريخ |
| `description` | text | البيان/الوصف |
| `category` | text | التصنيف (رواتب/حوافز/تشغيل/تبرعات… قابل للتوسعة) — تُرحَّل إليه الرواتب وحوافز الحلقات |
| `type` | enum | `income` (وارد) / `expense` (صادر) |
| `amount` | numeric | المبلغ |
| `created_by` | uuid FK → profiles | |
| `source_key` | text **UNIQUE** (nullable) | مصدر الحركة المرحَّلة آلياً: `salaries:YYYY-MM` / `incentives:YYYY-MM` — إعادة الترحيل `upsert` على المفتاح فتُحدّث حركة الشهر لا تكرّرها. فارغ للحركات اليدوية (هجرة `20261019073029`) |

> **الرصيد المتبقّي محسوب** (السابق + الوارد − الصادر) — لا يُخزّن، يُحسب عند العرض أو عبر view.

**RLS** (`fintx_all`): الكتابة `admin_manager` فقط، والقراءة `admin_manager` و`project_supervisor`. المديرة الإدارية والمدير الفني لا يمسّان المالية.

**`transaction_attachments` — مستنداتُ الحركة (فواتير وإيصالات — ROADMAP #17، هجرة `20261019130119`):** صفٌّ لكلّ ملفّ، وللحركة الواحدة أكثر من ملفّ.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `transaction_id` | uuid FK → financial_transactions **ON DELETE CASCADE** | |
| `storage_path` | text **UNIQUE** | `transactions/<transaction_id>/<uuid>.(jpg\|png\|webp\|pdf)` — قيد `transaction_attachments_path_shape` يربط المسار بحركته |
| `file_name` | text | الاسم الأصليّ (1–200 حرف) |
| `mime_type` | text | `image/jpeg` / `image/png` / `image/webp` / `application/pdf` |
| `size_bytes` | integer | 1 بايت – 10 م.ب |
| `uploaded_by` | uuid FK → profiles | افتراضاً `auth.uid()` |
| `created_at` | timestamptz | |

**RLS** (`txdocs_*`): القراءة `admin_manager` و`project_supervisor`، والإدراج والحذف `admin_manager`، ولا تعديل. `anon` بلا منح.
**المستودع `finance-docs` (خاصّ، 10 م.ب، صورٌ وPDF):** القراءة للاثنين، والرفع للمدير الإداري بالمسار النمطيّ الكامل وحده (لا جذر ولا مسارَ آخر)، والحذف له. ولا يُستعمل `media` لأنه عامّ. الحذفُ بالتتالي يمسح الصفوف، والواجهةُ تمسح الملفّاتِ بعده (`Transactions.vue`).

---

## 11. `admin_alerts` — التنبيهات الإدارية للمعلمين

المُصدِر: المدير الإداري أو الفني أو المشرف الميداني. المُستقبِل: المعلم.

> **تمييز عن الإشعارات (جرس الشريط العلوي):** هذا الجدول لـ«التنبيهات الإدارية» التي يُصدرها العاملون للمعلمين عند المخالفة (كيان مخزَّن). أمّا الجرس فقسمان: **«بانتظارك»** يُشتقّ **محسوباً** من حالات `supervision_visits` / `monthly_reports` / `exam_lists` / التنبيهات، و**«الإشعارات»** أخبارٌ مخزّنة في `notifications` (§18) يكتبها مُشغِّل `admin_alerts_notify` عند كل تنبيهٍ جديد (منذ 2026-10-19). مركز الإشعارات الموحّد الدائم داخل المنصّة صار جزءاً من الإصدار الثاني (`ROADMAP` البند 34).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `issuer_id` | uuid FK → profiles | المُصدِر |
| `teacher_id` | uuid FK → profiles | المعلم المُستقبِل |
| `violation_type` | text | نوع المخالفة (قائمة جاهزة + «أخرى») |
| `severity` | enum | `note` / `first_warning` / `final_warning` |
| `description` | text | وصف المخالفة |
| `alert_date` | date | التاريخ |
| `status` | enum | `new` / `acknowledged` |
| `acknowledged_at` | timestamptz | تاريخ الإقرار بالاستلام |

**RLS** (`alerts_*`):
- **القراءة:** المُصدِر، والمعلم المعنيّ، ومشرف المشروع، والمديران؛ والمديرة تنبيهات معلّمات حلقات البنات (من لها حلقة `female`).
- **الإدراج:** المديران والمشرف الميداني، و`issuer_id = auth.uid()`.
- **التعديل:** المُصدِر أو المعلم المعنيّ أو `admin_manager`؛ والحارس `guard_alert_update` (§17) يقصر المعلم المعنيّ على الإقرار (`status` و`acknowledged_at`) فلا يغيّر المحتوى.

---

## 12. `app_settings` — إعدادات المدير القابلة للضبط

صف واحد (أو key-value) للثوابت التي يضبطها المدير.

| العمود | النوع | الافتراضي | ملاحظات |
|---|---|---|---|
| `id` | int PK | 1 | صف واحد |
| `pass_mark` | int | 80 | علامة اجتياز الاختبار |
| `target_memorization_pages` | int | 30 | صفحات الحفظ المستهدفة |

> حُذف العمودان `default_points` و`default_attendance_days` في `20261019111920_drop_old_report_model` (النقاطُ مُلغاة، والانتظام من `attendance_days`).

**RLS** (`settings_*`): قراءة لكل حساب مسجَّل، كتابة `admin_manager` فقط.

---

## 13. `news` — الأخبار (§4.26)

وحدة أخبار المدير الإداري، تُعرض للزوّار على Landing (أحدث 3).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | العنوان |
| `news_date` | date | التاريخ |
| `category` | text | التصنيف (إعلان / إنجاز / فعالية…) |
| `body` | text | نص الخبر |
| `image_url` | text | صورة اختيارية (Supabase Storage) |
| `published` | boolean | منشور (يظهر على Landing) |
| `created_by` | uuid FK → profiles | |

**RLS:** سياستا قراءة منفصلتان (لأنّ `anon` لا يملك تنفيذ دوالّ النطاق، وPostgres يفحص صلاحية الدالّة عند تهيئة التعبير فتُسقط «published or is_admin_manager()» قراءة الزائر كلَّها): `news_select_published` للزوّار وللمسجَّلين (`published`)، و`news_select_staff` للمدير الإداري ومشرف المشروع (كل الأخبار). الإنشاء/التعديل/الحذف **للمدير الإداري فقط** (`news_write`).

---

## 14. `monthly_salaries` — الرواتب الشهرية المرجعية (§4.20ج)

🔒 المدير الإداري (كتابة) ومشرف المشروع (قراءة). الرواتب متفاوتة شهرياً — تُقيَّد للمرجع، مع اعتماد/قفل لكل شهر.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid FK → profiles | العامل |
| `salary_month` | int | الشهر |
| `salary_year` | int | السنة |
| `amount` | numeric | راتب الشهر (₪) |
| `approved` | boolean | معتمد (مقفل ضد التعديل) |
| `approved_by` | uuid FK → profiles | المُعتمِد |
| `approved_at` | timestamptz | تاريخ الاعتماد |

> تفرّد: عامل واحد لكل (شهر/سنة). الإجمالي الشهري محسوب، ويُرحَّل كحركة «صادر/رواتب». بعد الاعتماد تُمنع التعديلات خادميّاً.

**RLS** (`salaries_all`): الكتابة `admin_manager` فقط، والقراءة `admin_manager` و`project_supervisor`. (واجهة الرواتب تستثني مشرف المشروع والمدير الفني بقرار 2026-10-18.)

---

## 15. `halaqa_incentives` — تخصيص حوافز الحلقات الشهري (§4.20د)

🔒 المدير الإداري (كتابة). المبلغ المخصّص لكل حلقة في كل شهر، مع اعتماد/قفل لكل شهر. يصل المعلم للقراءة فقط في كشفه.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `halaqa_id` | uuid FK → halaqat | الحلقة |
| `incentive_month` | int | الشهر |
| `incentive_year` | int | السنة |
| `allocated_amount` | numeric | المبلغ المخصّص (₪) — متفاوت بين الحلقات |
| `approved` | boolean | معتمد التخصيص (مقفل) — به يصل المبلغ للمعلم |
| `approved_by` | uuid FK → profiles | المُعتمِد |
| `approved_at` | timestamptz | تاريخ الاعتماد |

> تفرّد: حلقة واحدة لكل (شهر/سنة). مصدر المبلغ المخصّص في كشف المعلم (§16) للقراءة فقط.

**RLS** (`incentives_*`): الكتابة `admin_manager` فقط (حتى المديرة والمدير الفني لا يخصّصان)؛ القراءة `can_view_halaqa(halaqa_id)` فيراه المعلم لحلقته (للعرض في كشفه) ومن يرى الحلقة.

---

## 16. `incentive_statements` — كشف حوافز الحلقة الشهري (المعلم — §4.25)

المعلم يرفع كشفاً بمصروفات مبلغ الحوافز، يطّلع عليه المدير (§4.20د).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `halaqa_id` | uuid FK → halaqat | |
| `statement_month` | int | الشهر |
| `statement_year` | int | السنة |
| `received_amount` | numeric | المستلَم = المبلغ المخصّص (من §15، للقراءة) |
| `submitted_at` | date | تاريخ التسليم (للتدقيق) |
| `status` | enum | `draft` / `submitted` / `reviewed` (قيد الإعداد/مُسلّم/مُطّلع عليه) |
| `reviewed_by` | uuid FK → profiles | من أقرّ «تمّ الاطّلاع» (من نطاق الاعتماد) |
| `reviewed_at` | timestamptz | تاريخ الاطّلاع |
| `return_note` | text | ملاحظةُ المراجِع حين يعيد الكشف للمعلّم (3–500 حرف إن أُعيد — قيد `incentive_statements_return_note_len`)؛ تبقى سجلّاً بعد إعادة الإرسال |
| `returned_by` / `returned_at` | uuid FK → profiles / timestamptz | من أعاده ومتى |
| `created_by` | uuid FK → profiles | المعلم |

**`incentive_statement_items` — بنود المصروفات (صف لكل بند):**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `statement_id` | uuid FK → incentive_statements | |
| `description` | text NOT NULL | الوصف/البيان — 3 أحرف فأكثر بعد حذف المسافات (`incentive_statement_items_description_len`) |
| `category` | text | جوائز / أنشطة / ضيافة / أخرى |
| `amount` | numeric | المبلغ (₪) — أكبر من صفر (`incentive_statement_items_amount_positive`) |
| `item_date` | date NOT NULL | التاريخ — داخل شهر الكشف ولا يتجاوز اليوم بتوقيت غزة (المشغِّل `incentive_statement_items_guard_date` ← `guard_statement_item_date`) |

> **الإعادة إلى المعلّم (هجرة `20261019141105`، طلب المستخدم 2026-10-19):** `return_statement(p_statement, p_note)` (`security invoker`) للمراجِع وحده (`can_review_statement_in_halaqa`)، على كشفٍ مُرسَل أو مُطّلَع عليه، بملاحظةٍ ≥ 3 أحرف: يعيده `draft` ويمسح `reviewed_by/at` ويكتب حقول الإعادة. والحارس `guard_statement_status` صار يرفض أن يكتب المعلّمُ حقولَ الإعادة أو يمسحها. مُختبَرٌ في معاملةٍ ملغاة (المعلّم والفني لا يعيدان، والملاحظةُ القصيرة مرفوضة، والمسوّدةُ لا تُعاد، والمعلّمُ يعيد الإرسال وتبقى الملاحظة).

> **التوثيق (هجرة `20261019124522`، ROADMAP #13):** القيدان `NOT VALID` — يُفرضان على كلّ إدراجٍ وتعديلٍ جديد ولا يُعاد فحص القديم (بيانات التجريب فيها بندٌ بمبلغ 0). والواجهة تتحقّق أولاً برسائل عربية (`useIncentiveStatement`)، والمراجِع يرى البنود في نافذة (`FinanceStatementReviewModal`) قبل «تمّ الاطّلاع».

> **المصروف** = مجموع البنود (محسوب)، و**المتبقّي = المستلَم − المصروف** (محسوب، تحذير عند التجاوز). تفرّد: كشف واحد لكل حلقة لكل (شهر/سنة). يُقفل بعد التسليم. مصدر حقيقة واحد مع جدول المدير (§4.20د).

**RLS** (`statements_*` و`sitems_*`):
- **القراءة:** `can_view_halaqa(halaqa_id)`.
- **الكتابة:** معلّم الحلقة (الكشف **والبنود ما دام `draft`**) أو نطاق الاعتماد (`can_approve_in_halaqa`: المديران + المديرة لحلقات البنات) الذي يراجع فيحوّل الحالة إلى `reviewed`.
- **الحارس `guard_statement_status`** (§17): المعلم ينقل `draft→submitted` ويعدّل ما دام مسودّة؛ `reviewed` وحقلا `reviewed_by/at` لنطاق الاعتماد وحده؛ وبعد الإرسال لا تعديل ولا حذف إلا بيد من يعتمد.

---

## ملاحظات على الحساب (Computed — لا تُخزّن)

هذه تُحسب في الكود أو views، لا تُخزّن كحقول:

- **العمر** = من `birth_date`.
- **الحفظ التراكمي للطالب** = مجموع `memorization_pages` لكل تقارير الطالب حتى الشهر المعروض (لا يُخزّن — يُشتقّ بالتجميع).
- **الرصيد المالي المتبقّي** = تراكمي (السابق + وارد − صادر).
- **المدة الفعّالة للطالب** = (تاريخ القياس − الالتحاق) − الغياب بعذر.
- **مؤشر التقدّم الزمني** = الحفظ التراكمي (من التقارير) مقابل المدة الفعّالة → متقدّم/في المسار/متأخّر.
- **الاختبار المستحقّ القادم** = من سجلّ الاختبارات المعتمدة (آخر محطة مجازة ← التالية).
- **إنجاز الحلقة** = (متوسط درجات الطلاب × 0.8) + (نسبة الأنشطة × 0.2).
- **درجة الطالب** = أكاديمي 60% + انتظام 20% + نقاط 20%.
- **التزام المشرف** = (زيارات في وقتها) ÷ (المستحقّة) × 100.

> راجع §4.24 في البريف لتفاصيل كل معادلة وعتباتها.

---

## 17. الأدوار ودوالّ النطاق والحرّاس والمستودعات (الإصدار الثاني)

> الهجرات: `20261017132335_v2_roles_rls` (النوع الجديد وإعادة بناء السياسات) ← `20261017135124_v2_women_admin_role` (قيمة `women_admin`) ← `20261017135631_v2_hardening` (إسقاط `section`، الدوالّ والحرّاس والسياسات النهائية) ← `20261018072525_v2_single_admin_index` ← `20261018080234_profile_photos` ← `20261018081904_profile_photos_gender_sync` ← `20261018083507_student_journey_rpcs`. الاختبار: `supabase/tests/v2_rls.sql` (كل بلوك معاملةٌ تُلغى، يُشغَّل بجلسة كل دور).

### الأدوار (`user_role`) والنطاق

لا عمود `section` (أُسقط بعد المراجعة: كان يفتح رفع النطاق ذاتياً) — **النطاق في الدور**:

| الدور | النطاق |
|---|---|
| `project_supervisor` | قراءة كل شيء بلا أي كتابة |
| `admin_manager` | القسمان؛ **شخص واحد نشط** — فهرس فريد جزئي `profiles_one_active_admin_manager on profiles(role) where role='admin_manager' and status='active'` (استبدل مُشغِّلاً مؤقتاً بعد تفريغ البيانات التجريبية). الوحيد الذي ينشئ الحسابات ويعيد التعيين ويغيّر الدور/الحالة/الرقم/الجنس |
| `technical_manager` | القسمان؛ **شخص واحد نشط** — فهرس `profiles_one_active_technical_manager` (الصيغة نفسها) |
| `women_admin` | قسم البنات: ترى كل شيء في حلقات `gender='female'` وطالباتها ومعلّماتها، وتُسند الطالبات وتعتمد التقارير وكشوف الحوافز؛ **لا تنشئ حسابات ولا تمسّ المالية والرواتب والمحاضر والأخبار والإعدادات ولا تُنشئ الحلقات** |
| `field_supervisor` | حلقاته (`halaqat.supervisor_id`): الزيارات، وإسناد طلابها |
| `examiner` | حلقاته (`halaqat.examiner_id`): رصد الاختبارات |
| `teacher` | حلقته الواحدة (`halaqat.teacher_id`) |
| `student` | صفّه وحده (`students.user_id = auth.uid()`) |

> النوع القديم (`manager/quality/supervisor/teacher/examiner`) أُسقط وبُدِّل بنوعٍ جديد لأن `ALTER TYPE … DROP VALUE` غير موجود في Postgres. وعمود `profiles.quality_supervisor_id` حُذف (لا مشرف جودة).

### دوالّ النطاق (كلها `SECURITY DEFINER` + `set search_path = public` + `revoke … from public, anon` + `grant execute … to authenticated`)

| الدالّة | المعنى |
|---|---|
| `current_user_role()` | دور المستدعي **إن كان حسابه `active`** وإلا `null` (فالحساب المعطَّل يفقد كل نطاقه) |
| `is_project_supervisor()` / `is_admin_manager()` / `is_women_admin()` | اختبار الدور |
| `in_admin_scope(g gender_type)` | نطاق الإدارة على جنسٍ ما: المديران كله، والمديرة البنات (للطلاب غير المُسنَدين) |
| `can_view_halaqa(hid)` | **القراءة:** مشرف المشروع والمديران (الكل)، والمديرة (حلقات البنات)، ومن أُسند إليها مشرفاً أو مختبِراً أو معلّماً (وحسابه نشط) |
| `can_manage_halaqa(hid)` | **الإدارة البنيوية** (تعديل الحلقة، قوائم الاختبار، النتائج، الزيارات): `admin_manager` و`technical_manager` فقط — لا المديرة |
| `can_approve_in_halaqa(hid)` | **اعتماد** التقارير وكشوف الحوافز: المديران + المديرة لحلقات البنات |
| `can_approve_report_in_halaqa(hid)` | **اعتماد الرصد القرآنيّ الشهريّ وتعديلُ سجلّاته حتى الاعتماد** (منذ `20261019094547`، قرار 2026-10-19): المشرف الميداني للحلقة (`halaqat.supervisor_id = auth.uid()`)، والمدير الإداري، والمديرة الإدارية لحلقات البنات (`gender='female'`) — **لا المدير الفني** (يطّلع ولا يعتمد). مستقلّةٌ عن `can_approve_in_halaqa` التي يعتمد عليها الإسناد وكشف الحوافز فلا تُمسّ. التفصيل §21 |
| `can_assign_in_halaqa(hid)` | **إسناد الطلاب وإخراجهم:** نطاق الاعتماد + المشرف الميداني لحلقاته |
| `is_halaqa_teacher(hid)` / `is_halaqa_examiner(hid)` / `is_halaqa_supervisor(hid)` | الإسناد المباشر (المعلم والمختبِر وهذا الأخير للمشرف الميداني فقط)؛ المعلم والمختبِر يشترطان حساباً نشطاً |
| `my_student_id()` / `my_halaqa_id()` | سجلّ الطالب وحلقته من `students.user_id = auth.uid()` |
| `my_exam_cycle_results()` | **رحلة الطالب (منذ `20261019121528`):** `(exam_cycle_id, passed, total_score, exam_date)` لكلّ محاولات الطالب نفسه على الدورات (مقصورة على `students.user_id = auth.uid()`، بلا `teacher_note`)، مرتَّبةً بالدورة ثم التاريخ. `security definer`، `search_path=''`، `revoke … from public, anon`، `grant execute … to authenticated` (§22) |
| `my_exam_results()` | حُذفت 2026-10-19 (هجرة 20261019145800)؛ حلّت محلّها `my_exam_cycle_results()` أعلاه |
| `my_approved_pages()` | مجموع `pages_memorized` من `quran_records` الطالب نفسه في الشهور **المعتمدة** وحدها (حُوِّلت من الجدول القديم في `20261019094547`) |
| `my_quran_months()` | **سجلُّ الطالب:** `(report_year, report_month, from_surah, from_ayah, to_surah, to_ayah, pages_memorized, pages_reviewed)` لشهوره المعتمدة وحدها مرتَّبةً بالأقدم، مقصورةً على `my_student_id()` (§21) |
| `can_view_profile_photo(folder)` / `can_manage_profile_photo(folder)` | سياسات مستودع الصور (§ المستودعات) |
| `claim_employee_number()` | `nextval` من `employee_number_seq` (يبدأ 1001، حدّه 9999) — **للخدمة وحدها** (`grant … to service_role` فقط، مسحوب من `authenticated`) |

> سبب `my_exam_cycle_results()` (وقبلها `my_exam_results()` المحذوفة 2026-10-19) و`my_approved_pages()` و`my_quran_months()`: الطالب لا يجتاز سياستَي `exam_list_items` و`monthly_reports` (`can_view_halaqa`) ولا يقرأ `quran_records` مباشرةً (أُسقط فرعُ الطالب منها في `20261019095659`) فتصله التضمينات `null` — محطّاتٌ مجتازة تظهر «مستحقّة» وصفحاتُ الحفظ المعتمدة صفر. الدوال تفتح له سطوره المعتمدة وحدها دون فتح الجداول (`20261018083507`، و`20261019094547` للأخيرتين).

### الحرّاس (مُشغِّلات `SECURITY DEFINER`؛ الخدمة والهجرات `auth.uid() is null` تمرّ دائماً)

| المُشغِّل ← الدالّة | ما يحرسه |
|---|---|
| `profiles_guard_privileged` ← `guard_profile_privileged` | `role`/`status`/`employee_number`/**`gender`** للمدير الإداري وحده؛ و`must_change_password`: صاحبه يطفئه فقط (`true→false`) ولا يرفعه إلا المدير الإداري أو الخدمة |
| `students_guard_assignment` ← `guard_student_assignment` | `user_id`/`gender`/`national_id`/`view_token` للمدير الإداري وحده؛ الإخراج من حلقةٍ يحتاج `can_assign_in_halaqa` فيها؛ الإدخال إلى حلقةٍ يحتاجه وتطابقَ جنس الطالب وجنس الحلقة (`23514`) |
| `monthly_reports_guard_status` ← `guard_report_status` | المعلم: `draft→submitted` وتعديل المسودّة فقط؛ `approved` وحقلا `approved_by/at` لمعتمِد الحلقة (`can_approve_report_in_halaqa`) وحده؛ ولا تعديل بعد الإرسال إلا بيده؛ **وحذفُ غير المسوّدة للمدير الإداري وحده** (منذ `20261019095659`). يعمل بعد `monthly_reports_flow` أبجدياً ولا يحلّ محلّه (§21) |
| `incentive_statements_guard_status` ← `guard_statement_status` | مثله لـ`reviewed` وحقلَي `reviewed_by/at` — لكن بنطاق `can_review_statement_in_halaqa` (المدير الإداري، والمديرة الإدارية للبنات؛ **بلا المدير الفني** منذ هجرة `20261019082403`)، والقراءة `can_view_statements_in_halaqa` (معلم الحلقة، مشرف المشروع، المراجِع) |
| `admin_alerts_guard_update` ← `guard_alert_update` | المعلم المعنيّ لا يغيّر إلا الحالة ووقت الإقرار؛ المُصدِر والمدير الإداري يغيّران المحتوى |
| `profiles_photo_clear_on_female` ← `clear_photo_on_female` | حين يصير الحسابُ أنثى يُفرغ `photo_path` آلياً (بدل خطأ `23514` على المدير) |
| `students_sync_gender_to_profile_ins/_upd` ← `sync_student_gender_to_profile` | يزامن `profiles.gender` لحساب الطالب من `students.gender` |
| `halaqat_guard_staff` ← `guard_halaqa_staff` | **لكل كاتبٍ حتى الخدمة:** جنس الحلقة مطلوب؛ المعلم (`teacher`) والمشرف (`field_supervisor`) والمختبِر من جنسها؛ المعلم على حلقةٍ نشطة واحدة (يُفحص عند تغيّر المعلم أو تفعيل الحلقة فقط)؛ لا يتغيّر جنس حلقةٍ فيها طلاب من الجنس الآخر؛ ويختم `assigned_by` بالمستدعي عند الإنشاء وتغيير المعلم/المشرف (`23514`) |
| `profiles_guard_gender_vs_halaqat` ← `guard_staff_gender_vs_halaqat` | لا يتغيّر جنس موظفٍ هو في طاقم حلقةٍ من الجنس الآخر |
| `exam_list_items_guard_sequence` ← `guard_station_sequence` | حُذف 2026-10-19 (هجرة 20261019145800)؛ حلّ محلّه `exam_list_items_guard_cycle` أدناه |
| `exam_list_items_guard_cycle` ← `guard_cycle_sequence` | **لكل كاتب، للبنود بدورةٍ وحدها** (`exam_cycle_id` ليس فارغاً؛ وتتابعُ مُشغِّلٍ آخر `pg_trigger_depth() > 1` يمرّ): عند الإدراج أو تغيير الدورة/الطالب يأخذ قفلاً استشارياً لكل طالب (`pg_advisory_xact_lock`) كي لا يمرّ ترشيحان متزامنان، ثم يرفض (`23514`): (١) ترشيحاً ثانياً لطالبٍ له ترشيحٌ بدورةٍ بلا نتيجة، (٢) أيَّ دورةٍ غير **المستحقّة** = أولُ دورةٍ بـ`sort_order` لم يجتزها الطالب (نتيجةٌ `passed`)، (٣) الترشيحَ بعد إتمام الدورات الخمس عشرة. الرسائل: «للطالب ترشيحٌ بانتظار الرصد…»، «الدورةُ المستحقّة للطالب: المرحلة % · الدورة %.»، «أتمّ الطالب الخطة…» |
| `exam_list_items_guard_graded` ← `guard_graded_item` | **لكل كاتب** (`before update or delete`): بندٌ له نتيجةٌ لا يُحذف («لا يُحذف ترشيحٌ رُصدت نتيجته.») ولا تُغيَّر دورتُه أو طالبُه («لا تُغيَّر دورةُ ترشيحٍ مرصود.») وإلا تراجعت «الدورة المستحقّة» بصمت. **يُستثنى** الحذفُ المتتالي من حذف الطالب نفسه (التاريخُ يزول بزوال صاحبه). وهو ما يمنع حذفَ حلقةٍ لها ترشيحاتٌ مرصودة (تُعطَّل بدل أن تُحذف) |
| `exam_results_guard_link` ← `guard_result_link` | `before update`: لا يُنقل `student_id` النتيجة، ولا `exam_list_item_id` إلى بندٍ آخر؛ **يُستثنى** تصفيرُه بـ`on delete set null` حين يزول البند نفسه |
| `exam_results_guard_pass_mark` ← `guard_result_pass_mark` | **لكل كاتب** (`before insert or update`، منذ `20261019142657`): عند الإدراج `pass_mark_snapshot := app_settings.pass_mark` (قيمةُ العميل تُهمَل، فلا يُنجِّح راصدٌ الجميعَ بوضع 0)، وعند التعديل تبقى كما رُصدت؛ وإن كان للنتيجة `exam_list_item_id` وجب أن يطابق `student_id` طالبَ الترشيح («الطالب في النتيجة لا يطابق طالبَ الترشيح.»)؛ ونتيجةٌ بلا ترشيح لا تُربط بترشيحٍ لاحقاً («لا تُربط نتيجةٌ قائمةٌ بترشيحٍ بعد رصدها.»). كلُّها `23514`. لا يكرّر ما يمنعه `guard_result_link` (نقلُ الطالب أو نقلُ نتيجةٍ مربوطة). `security definer`، `search_path=''`، `revoke all … from public, anon, authenticated` |
| `exam_cycles_guard_edit` ← `guard_exam_cycle_edit` | `before update`: لا يُغيَّر `id` ولا `stage_number` ولا `cycle_number` (`23514`) — تعديلُ الأجزاء والتسمية وحدها، حزامٌ فوق منح الأعمدة |
| `exam_cycles_consistency` ← `check_exam_cycles_consistency` | **قيدٌ مؤجَّل** (`constraint trigger … deferrable initially deferred`، `after update for each row`): بعد كلّ تعديل يُفحص داخل كل مرحلة أنّ الدورة 2 تحوي الأولى، و4 تحوي 3، و5 تحوي 1–4 (`parts_from` أصغر أو يساوي و`parts_to` أكبر أو يساوي)؛ المؤجَّل يتيح تعديلَ عدّة دوراتٍ معاً في معاملةٍ واحدة. الرسالة «المرحلة %: نطاقُ الدورة % يجب أن يشمل نطاقَ الدورة %.» |
| `supervision_visits_guard_visitor` ← `guard_visit_visitor` | **لكل كاتب:** الزائر المشرف الميداني المُسنَد للحلقة نفسها (منذ `20261019091015`؛ كان يقبل المديرَين)؛ يُفحص عند الإنشاء وتغيير الحلقة أو الزائر فقط (`23514`). والسياسات: الإدراج والتعديل وسجلّ إعادة الجدولة لصاحب الزيارة، والحذف له وللمدير الإداري، والقراءة `can_view_halaqa` |

> المُشغِّلات `admin_alerts_notify` و`supervision_visits_notify` و`exam_list_items_notify_nominated` و`exam_results_notify_graded` ليست حرّاساً: هي مُنتِجات الإشعارات (§18، §22). وبقية مُشغِّلات الاختبار: `exam_results_bump_parts` (إدراج) و`exam_results_bump_parts_on_update` (انتقالٌ إلى «ناجح») ← `bump_parts_on_pass` (§22).

> **ترتيب مُشغِّلات BEFORE على `profiles`:** `profiles_guard_privileged` ← `profiles_photo_clear_on_female` ← `trg_profiles_updated_at` (أبجدياً)، فالحارس يرفض تغيير الجنس غير المأذون قبل أن يُفرَغ شيء.

### المستودعات (Storage)

| المستودع | النوع | القراءة | الكتابة |
|---|---|---|---|
| `media` | عامّ | عامّة (صور الأخبار على الهبوط) | `admin_manager` (`media_write_*`)، وكل مستخدم تحت `avatars/<معرّفه>/` فقط — و`coalesce(...)` تجعل الاسم في الجذر رفضاً صريحاً لا قبولاً (`storage.foldername` تُرجع مصفوفةً بلا عنصرٍ ثانٍ فالمقارنة NULL). سياساتها القديمة `media_auth_*` أُسقطت |
| `profile-photos` | **خاصّ** (256 ك.ب، `image/webp|png|jpeg`) | روابط موقَّعة لساعة: لصاحبها والمدير الإداري، ولكل حسابٍ نشط غير طالب إن كان `profiles.photo_path` غيرَ فارغ (`can_view_profile_photo`) | صاحب المجلّد أو المدير الإداري (`can_manage_profile_photo`)، والاسم ثابت `<profile_id>/photo.webp` (يُفرض في `with check` فلا يتيم ولا نقل لمجلّد غيره). **لا صورة لأي حساب `gender='female'`** (في `profiles` أو سجلّ الطالب المرتبط)، ولا للطالب الأنثى. القيد `profiles_photo_path_shape` يرفض أي مسار غير `<id>/photo.webp` ولأنثى |

> الكائن اليتيم بعد أن تصير الحسابة أنثى يبقى في المستودع بلا مسارٍ في الصفّ فلا يُوقَّع (القراءة تشترط `photo_path`)؛ تنظيفه بصلاحية الخدمة لاحقاً.

### الحسابات من الخادم

| المسار | من يستدعيه | ما يفعله |
|---|---|---|
| `POST /api/users` | `admin_manager` | `claim_employee_number()` ← حساب Auth ببريد الموظف الداخلي **وكلمةٍ مؤقّتة يولّدها الخادم** ← صفّ `profiles` (`must_change_password=true`، `assigned_by`)؛ يتراجع إن فشل الصفّ. يُعيد `{ id, employee_number, temp_password }` (الكلمة مرّةً واحدة، لا تُسجَّل). المدير الإداري/الفني الثاني النشط ← `23505` ← 409 بالعربية؛ والمديرة الإدارية بجنس الذكر ← 400. الرقم يُستهلك ولو فشل الإنشاء ولا يُعاد |
| `POST /api/students` | `admin_manager` | هوية 9 خانات ← حساب Auth (كلمة مؤقّتة من الخادم) ← `profiles` بدور `student` ← `students` مربوطاً بـ`user_id`؛ تطابق جنس الحلقة يُفحص قبل الإنشاء؛ الهوية المكرّرة ← 409. يُعيد `{ id, user_id, temp_password }` |
| `POST /api/users/reset-password` | `admin_manager` | لأي حساب (موظف أو طالب): يرفع `must_change_password` **أولاً** ثم يضبط كلمةً مؤقّتة جديدة ويعيدها `{ ok, temp_password }`. ⚠️ الجلسات القائمة لا تُلغى (`auth.admin.signOut` يأخذ رمز الجلسة لا معرّف المستخدم) |
| `DELETE /api/students/:id` | `admin_manager` | `profiles` ← حساب Auth ← صفّ `students` (كل خطوةٍ يُفحص ناتجها؛ الحساب قبل الصفّ كي يبقى الصفّ ظاهراً لإعادة المحاولة). التابعون يُحذفون بالتتالي |
| `PATCH /api/students/:id/national-id` | `admin_manager` | `{ national_id }`: تحقّق + فحص تكرار ← بريد Auth `<هوية>@students…` (مؤكَّد) ← `students.national_id`؛ يُعاد البريد القديم إن فشل الصفّ. التعديل المباشر للهوية من الواجهة أُلغي |

> **دخول الموظف** لم يعد مساراً خادمياً (`/api/auth/staff-login` حُذف 2026-10-18): المتصفّح يشتقّ البريد من الرقم ويدخل مباشرةً كالطالب، ثم يفحص `profiles.status`. **حالة الدخول** (`profiles.status`) يغيّرها المدير الإداري مباشرةً (حارس `guard_profile_privileged`) — من إدارة المستخدمين للموظف ومن ملف الطالب للطالب؛ وهي مستقلّة عن `students.status` الدراسية.

> **حالة البيانات:** بيانات الاختبار حُذفت 2026-10-18 (بقي `exam_plan` و`app_settings` حينها؛ وحُذف `exam_plan` لاحقاً 2026-10-19 بهجرة `20261019145800`)، والحساب الأول `1001` للمدير الإداري — كلمة مروره لا تُكتب في أي ملف. الاستيراد من Excel مؤجَّل: سيُدخل المستخدم الطلاب بمساعدة Claude.

---

## 18. `notifications` — إشعارات الأحداث (الدفعة الثانية، الجزء ١)

> الهجرات: `20261019081356_notifications` (المخطّط والجدول والسياسة والتعليم والنشر في Realtime) ← `20261019081750_notify_alerts_visits` (تقليمُ النصّ داخل `private.notify` بدل رفضه، والمُنتِجان) ← `20261019084801_notify_hardening` (تصليبُ `private.notify`: تحقّقٌ مسبق وتحذيرٌ لا استثناء وتقليمٌ يتخطّى المقفل). المواصفة: `docs/superpowers/specs/2026-10-19-v2-batch2-design.md` (الجزء ١). كلُّ هجرةٍ تفحص نفسها في كتلة `do` آخرها.

**المبدأ:** الإشعارُ خبرٌ عن أمرٍ وقع. أمّا طوابيرُ العمل (بنودٌ بانتظار الرصد، تقاريرُ بانتظار الاعتماد) فتُحسب عند العرض ولا تُخزَّن هنا — وهي «بانتظارك» في الجرس.

### المخطّط `private`

- غير مكشوف لـPostgREST: ما فيه لا يُستدعى من العميل.
- `revoke all on schema private from public, anon`، و`grant usage … to authenticated, service_role`.

### الجدول `public.notifications`

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `recipient_id` | uuid FK → auth.users | `not null`، `on delete cascade` |
| `kind` | text | قيدُ `check` على الأنواع العشرة أدناه |
| `title` | text | `not null`؛ `char_length(btrim(title))` بين 1 و120 |
| `body` | text | اختياري؛ ≤ 400 حرفاً |
| `link` | text | اختياري؛ **مسارٌ داخليّ فقط**: `^/[A-Za-z0-9/_?=&-]*$` — إشعارٌ يقود خارج المنصّة بابُ تصيّد |
| `source_table` / `source_id` | text / uuid | الصفّ الذي وقع عليه الحدث |
| `read_at` | timestamptz | `null` = غير مقروء |
| `created_at` | timestamptz | `default now()` |

**أنواع `kind` (العشرة):** `report_submitted` · `report_approved` · `report_returned` (الجزء ٢) · `alert_issued` · `visit_scheduled` (**مُنتَجان**) · `exam_nominated` · `exam_graded` (الجزء ٣ — **مُنتَجان منذ `20261019121528`**، §22) · `transport_paid` (الجزء ٤) · `impersonation_started` · `impersonation_write` (الجزء ٥). القيد يحملها كلّها من اليوم، ومُنتِجُها يُضاف مع جزئه.

**الفهارس:**

| الفهرس | على | لماذا |
|---|---|---|
| `notifications_inbox_idx` | `(recipient_id, created_at desc)` | قائمة الصندوق (آخر 30) |
| `notifications_unread_idx` | `(recipient_id) where read_at is null` | عدّاد غير المقروء |
| `notifications_expiry_idx` | `(created_at)` | تقليم ما مضى عليه ثلاثة أشهر |

**RLS:** مُفعَّل. سياسةٌ **واحدةٌ** `notifications_read` — `for select to authenticated using (recipient_id = (select auth.uid()))`. **لا سياسةَ إدراجٍ ولا تعديلٍ ولا حذف**؛ الكتابة كلّها عبر `private.notify`.

**المنح:** `revoke all … from anon, authenticated` **ثم** `grant select … to authenticated`. السبب: Supabase تمنح `anon` و`authenticated` كلَّ الحقوق افتراضياً على كل جدولٍ جديد في `public`، فالسحبُ أولاً.

**Realtime:** الجدول في منشور `supabase_realtime`، فيحترم الاشتراكُ سياسةَ RLS. العميل يشترك بمرشّح `recipient_id=eq.<uid>`، ومع الاستطلاع الاحتياطيّ كلّ دقيقة حين يكون التبويب ظاهراً.

### الدوالّ والمُشغِّلات

| الاسم | النوع | ما تفعله |
|---|---|---|
| `private.notify(p_recipient, p_kind, p_title, p_body, p_link, p_source_table, p_source_id)` | `security definer`، `search_path=''`، void | **البابُ الوحيد للكتابة.** (١) لا شيء إن كان المستلم فارغاً، أو كان هو المستدعي (`auth.uid()`) — فلا يُشعَر أحدٌ بفعله هو؛ والخدمةُ والهجرات (`auth.uid()` فارغ) لا تُستثنى من هذا الشرط الثاني. (٢) يقصّ العنوان إلى 120 حرفاً والنصّ إلى 400 **ولا يرفض**: الرفض كان سيُسقط العمليةَ الأصلية. (٣) **تحقّقٌ مسبق بتحذيرٍ لا استثناء:** نوعٌ خارج العشرة، أو رابطٌ لا يطابق `^/[A-Za-z0-9/_?=&-]*$`، أو عنوانٌ فارغٌ بعد القصّ ← `raise warning 'notify: …'` ثم `return` بلا إدراج (القيدُ نفسه كان سيرمي ويُسقط العمليةَ الأصلية). (٤) يُدرج، ثم يقلّم ما مضى عليه ثلاثة أشهر بدفعةٍ أقصاها 200 صفّ **بـ`for update skip locked`** (ما أقفله غيرُنا يُترك لدورةٍ لاحقة)؛ والإدراجُ والتقليمُ معاً داخل كتلة `begin … exception when others then raise warning 'notify failed: %', sqlerrm; end` — **فشلٌ داخل notify لا يُسقط عمليةَ المستخدم أبداً** (منتِجو الأجزاء القادمة سيُشعِرون عدّة مستلمين في معاملةٍ واحدة). قائمةُ الأنواع داخل الدالّة نسخةٌ ثانية من القيد: إضافةُ نوعٍ تعدّل القيدَ والدالّة معاً. مسحوبةٌ من `public` و`anon` و`authenticated` — تُستدعى من المُشغِّلات وحدها. |
| `private.notify_alert_issued()` | trigger، `security definer` | ينادي `notify`: المستلم `teacher_id`، والنوع `alert_issued`، والعنوان «تنبيهٌ إداريّ جديد»، والنصّ `violation_type`، والرابط `/alerts`، والمصدر `admin_alerts`. |
| `private.notify_visit_scheduled()` | trigger، `security definer` | ينادي `notify`: المستلم `supervisor_id` (المشرف الميداني)، والنوع `visit_scheduled`، والعنوان «جُدولت لك زيارةٌ إشرافية»، والنصّ «اسم الحلقة · DD-MM-YYYY HH24:MI» بتوقيت غزة (إن غاب اسم الحلقة يصير «حلقة»)، والرابط `/visits`، والمصدر `supervision_visits`. **لا إشعار إن جدولها المشرف لنفسه** (يمنعه `notify`). |
| `public.mark_notifications_read(p_ids uuid[] default null)` | `security definer`، يُرجع integer | يعلّم **إشعارات المنادي** غير المقروءة وحدها (`auth.uid()`) — المحدَّد بالمعرّفات، أو الكلّ إن كانت `null` — ويُرجع عددها. **لا سياسة `update`**: صاحب الإشعار لا يعيد كتابة نصّه. `grant execute … to authenticated`، و`revoke` من `public` و`anon`. |
| `private.notify_exam_nominated()` | trigger على الجملة، `security definer` | ينادي `notify` **مرّةً لكلّ قائمةٍ** (لا لكلّ طالب) من جدول الانتقال `new_items`: المستلم مختبِرُ الحلقة (`halaqat.examiner_id`)، والنوع `exam_nominated`، والعنوان «ترشيحٌ جديد للاختبار»، والنصّ «اسم الحلقة · عدد المرشّحين: N»، والرابط `/exams`، والمصدر `exam_lists`. (§22) |
| `private.notify_exam_graded()` | trigger، `security definer` | ينادي `notify` مرّتين: لمعلّم حلقة الطالب «اسم الطالب · ناجح/ناجحة/راسب/راسبة · المجموع N» ورابطُه `/exams`، وللطالب نفسه «نتيجتُك: … · المجموع N» ورابطُه `/me`؛ النوع `exam_graded`، والعنوان «رُصدت نتيجةُ اختبار»، والمصدر `exam_results`. الصياغة بجنس الطالب. (§22) |
| `admin_alerts_notify` | مُشغِّل `AFTER INSERT ON admin_alerts FOR EACH ROW` | ← `private.notify_alert_issued()` |
| `supervision_visits_notify` | مُشغِّل `AFTER INSERT ON supervision_visits FOR EACH ROW` | ← `private.notify_visit_scheduled()` |
| `exam_list_items_notify_nominated` | مُشغِّل `AFTER INSERT ON exam_list_items` (`referencing new table as new_items`، `FOR EACH STATEMENT`) | ← `private.notify_exam_nominated()` |
| `exam_results_notify_graded` | مُشغِّل `AFTER INSERT ON exam_results FOR EACH ROW` | ← `private.notify_exam_graded()` |

> المُشغِّلان بعد الإدراج (`AFTER`) فلا يغيّران الصفّ الأصليّ، ويعيدان `null`. دوالّهما `security definer` وبلا منحٍ للعميل.

### الفحص الذاتي للهجرة الأولى

تُلغي الهجرة نفسها إن خالف الواقعُ المقصود: RLS غير مفعّل، أو سياسةُ كتابةٍ غير مقصودة، أو منحُ القراءة ناقص، أو منحُ كتابةٍ زائد، أو `private.notify` مكشوفةٌ للعميل، أو `mark_notifications_read` غير قابلة للتنفيذ، أو الجدول خارج `supabase_realtime`. والثالثة (`notify_hardening`) تتحقّق أن `private.notify` موجودة وأنها `security definer` وغير قابلة للتنفيذ من `authenticated` و`anon`. والثانية تتحقّق من وجود المُشغِّلين ومن أن دوالّ الإشعار غير قابلة للتنفيذ من `authenticated`.

---

## 19. مراجعُ المصحف: `surahs` و`quran_pages` و`program_juz` (الدفعة الثانية، الجزء ٢)

> الهجرة: `20261019090831_quran_reference`. مراجعُ ثابتةٌ يقرؤها كلُّ مسجَّل ولا يكتبها أحدٌ من العميل. السورُ من `base_slice_schema` (الصحابة)، وفهرسُ الصفحات من `quran_mushaf_index` (مصدره Tanzil.net، مصحف المدينة 604 صفحات)، وتقسيمةُ الأجزاء من تصميم الدفعة الثانية.

### الجداول

| الجدول | المفتاح | الأعمدة | القيود والمعنى |
|---|---|---|---|
| `surahs` | `number` (1..114) | `name` (فريد)، `ayah_count` | 114 سورة مجموع آياتها **6236** |
| `quran_pages` | `page` (1..604) | `surah`، `ayah` | أوّلُ آيةٍ في كلّ صفحة من مصحف المدينة؛ `(surah, ayah)` فريد؛ FK إلى `surahs` |
| `program_juz` | `number` (1..30) | `start_surah`، `start_ayah`، `end_surah`، `end_ayah` | أجزاءُ البرنامج على حدود السور، مرقّمةٌ بترتيب الحفظ؛ FK إلى `surahs` |

- **ترتيبُ الحفظ** مفتاحٌ واحدٌ لكل المصحف: السورةُ تنازلياً (الناس 114 أوّلاً) والآيةُ داخلها تصاعدياً؛ فالبقرة تُحفظ من 1 إلى 286 ثم الفاتحة.
- **`program_juz`:** الجزء 30 = الناس 1 ← النبأ 40 (114:1–78:40)، والجزء 1 = البقرة 253 ← الفاتحة 7 (2:253–1:7). الأجزاء 30 إلى 1 متّصلةٌ بلا فجوةٍ ولا تداخل. **الفاتحةُ تُلحق بالجزء 1 ويُؤكَّد ذلك مع المستخدم.**

### الدالّة `quran_page_of(surah, ayah)`

تُرجع رقم الصفحة: آخرُ صفحةٍ بدايتُها ≤ الموضع بترتيب `(surah, ayah)`. `language sql stable security definer` بـ`set search_path = ''`، و`revoke` من `public` و`anon`، و`grant execute … to authenticated` وحده. فحصُ الهجرة: (1,1) ← 1، و(2,1) ← 2، و(114,6) ← 604.

### الحماية (RLS)

- مُفعَّلٌ على الجداول الثلاثة، وفيها سياسةُ قراءةٍ واحدة لكلٍّ منها (`using (true)`) للـ`authenticated`.
- **لا سياسةَ كتابةٍ ولا منحَ كتابة**، و`anon` لا يقرأ شيئاً.
- **الفحص الذاتي:** تُلغي الهجرة نفسها إن لم يكن 114 سورة و6236 آية و604 صفحات و30 جزءاً، أو خرجت صفحةٌ عن ترتيبها، أو بدأت صفحةٌ بآيةٍ تتجاوز عدد آيات سورتها، أو لم يتّصل جزءٌ بما بعده، أو تجاوزت حدودُ جزءٍ آياتِ سورته، أو خالفت الصلاحياتُ ما سبق.

---

## 20. الحضور اليوميّ: `attendance_days` و`attendance_absences` — بالاستثناء (الدفعة الثانية، الجزء ٢)

> الهجرات: `20261019091830_attendance` (الجداول والدوالّ والحرّاس والسياسات) ← `20261019092530_attendance_guards_cascade` (إصلاح الحذف التتابعيّ وتفريغ `recorded_by`). الشاشة: `/attendance`.

**المبدأ:** يومُ الحلقة المفتوح = حضورُ كلّ الملتحقين، فلا يُكتب صفٌّ إلا للغياب. وجودُ صفّ `attendance_days` يعني أنّ الحلقة انعقدت في ذلك اليوم، والغيابُ لا يُسجَّل إلا في يومٍ مفتوح.

### `public.attendance_days`

| العمود | النوع | ملاحظات |
|---|---|---|
| `halaqa_id` | uuid FK → `halaqat` | `on delete cascade` |
| `day` | date | يوم الحلقة (بتوقيت غزة) |
| `recorded_by` | uuid FK → `profiles` | `on delete set null`، والافتراضيّ `auth.uid()` |
| `created_at` | timestamptz | `default now()` |

**المفتاح:** `primary key (halaqa_id, day)` — يومٌ واحدٌ لكلّ حلقة.

### `public.attendance_absences`

| العمود | النوع | ملاحظات |
|---|---|---|
| `halaqa_id` | uuid | جزءٌ من المرجع المركّب إلى `attendance_days` |
| `day` | date | جزءٌ من المرجع المركّب إلى `attendance_days` |
| `student_id` | uuid FK → `students` | `on delete cascade` |
| `kind` | text | `check in ('excused', 'unexcused')`: بعذر أو بلا عذر |
| `recorded_by` | uuid FK → `profiles` | `on delete set null`، والافتراضيّ `auth.uid()` |
| `created_at` | timestamptz | `default now()` |

- **المفتاح:** `primary key (day, student_id)` — الطالبُ غائبٌ مرّةً واحدةً في اليوم.
- **المرجع المركّب:** `(halaqa_id, day)` إلى `attendance_days` بـ`on delete cascade`، فلا يُعلَّق غيابٌ إلا على يوم حلقته، وحذفُ اليوم يمحو غياباتِه تتابعياً.
- **فهرس:** `(student_id, day)` لحساب غياب الطالب في الشهر.

### الدوالّ المساعدة (schema `private`)

| الدالّة | المعنى |
|---|---|
| `attendance_today()` | «اليوم» بتوقيت `Asia/Gaza` لا توقيت الخادم؛ مَنحٌ لـ`authenticated` و`service_role` |
| `attendance_month_approved(halaqa, day)` | هل رصدُ شهر ذلك اليوم لتلك الحلقة في `monthly_reports` بحالة `approved`؛ مسحوبةٌ من الجميع، تُستدعى من الحرّاس وحدهم |

### الحرّاس (مُشغِّلات `BEFORE`؛ دوالّهما `security definer`)

| المُشغِّل ← الدالّة | ما يحرسه |
|---|---|
| `attendance_days_guard` ← `guard_attendance_days` | (١) **لا يُكتب يومٌ لم يأتِ:** الإدراج والتعديل لا يتجاوزان اليوم بتوقيت غزة. (٢) **الشهر المعتمَد مقفل:** الحذفُ والتعديلُ على اليوم القديم والإدراجُ والتعديلُ على الجديد يُرفضان إن كان رصدُ الشهر معتمَداً. (٣) **الحذفُ التتابعيّ** (`pg_trigger_depth() > 1`) يُتجاوَز، فيخضع للفحص الحذفُ المباشر وحده. (٤) **التعديلُ الذي لا يمسّ إلا `recorded_by`** (تفريغٌ تتابعيّ أو تصحيح) يمرّ دون فحص، فلا يغيّر شيئاً من الحضور. |
| `attendance_absences_guard` ← `guard_attendance_absences` | (١) **الشهر المعتمَد مقفل** كما في الأيام. (٢) **الطالبُ في الحلقة وملتحقٌ باليوم:** عند الإدراج أو تغيّر الطالب أو الحلقة أو اليوم، يجب أن يكون `students.halaqa_id` هو حلقة الغياب، وأن يكون `enrollment_date` (إن وُجد) ≤ اليوم. (٣) **الحذفُ التتابعيّ** يُتجاوَز (غيابُ طالبٍ محذوف يُمحى معه)، و**التعديلُ الذي لا يمسّ إلا `recorded_by`** يمرّ دون فحص. |

> الإدراجُ لا يُتجاوَز أبداً، فلا يأتي تتابعياً. التمييزُ بين الحذف التتابعيّ والمباشر بـ`pg_trigger_depth()`، أمّا التعديلُ الذي لا يمسّ إلا `recorded_by` فيُعرف بمقارنة الحقول قبل الفحص.

### سياسات RLS

| الجدول | القراءة | الإدراج والتعديل والحذف |
|---|---|---|
| `attendance_days` | `can_view_halaqa(halaqa_id)` أو `halaqa_id = my_halaqa_id()` (الطالب يرى أيامَ حلقته) | `is_halaqa_teacher(halaqa_id)` أو `can_approve_in_halaqa(halaqa_id)` |
| `attendance_absences` | `can_view_halaqa(halaqa_id)` أو `student_id = my_student_id()` (الطالب يرى غياباته) | `is_halaqa_teacher(halaqa_id)` أو `can_approve_in_halaqa(halaqa_id)` |

- مُفعَّل على الجدولين، وفيهما أربع سياسات لكلٍّ منهما: قراءةٌ واحدة وثلاث للكتابة.
- **المنح:** `select, insert, update, delete` لـ`authenticated` بعد سحب الكلّ من `public` و`anon` و`authenticated`؛ و`anon` لا يصل إليهما.
- **الفحص الذاتي:** الهجرة الأولى تتحقّق من تفعيل RLS وعدد السياسات والمنح والمُشغِّلين؛ والثانية تتحقّق من منح `authenticated` الأربعة، ومنعِ `anon`، وأن الحارسين `security definer` بـ`search_path` فارغ، وأن فيهما فحصَ `pg_trigger_depth() > 1`.

---

## 21. الرصد القرآنيّ الشهريّ: `quran_records` ومسارُ اعتماد المشرف (الدفعة الثانية، الجزء ٢)

> الهجرات: `20261019094547_quran_records` (الجدول والمعتمِد والحارس والسياسات والمسار والمُنتِجات وقراءتا الطالب) ← `20261019095659_quran_records_flow_hardening` (تصليبُ المسار وحذفُ غير المسوّدة وقراءةُ السجلّ وإشعارُ الاحتياط) ← `20261019110259_quran_records_final_fixes` (لقطةٌ لا تُزوَّر، واختصارُ التفريغ التتابعيّ قبل فحص المعتمَد، وروابطُ الإشعارات بالسنة والشهر، ومنعُ المستقبل بتاريخ غزة). الشاشة: `/reports` («الإنجاز القرآني»). المواصفة: `docs/superpowers/specs/2026-10-19-v2-batch2-design.md` (الجزء ٢).

**المبدأ:** رأسُ الشهر لكلّ حلقة هو `monthly_reports` (الحالة والأختام)، وسجلُّ كلّ طالبٍ فيه هو `quran_records`: من (سورة:آية) إلى (سورة:آية) بترتيب الحفظ (من الناس إلى الفاتحة)، وصفحاتُ الحفظ والمراجعة. لا أنشطةَ ولا نقاطَ ولا درجات.

> **القديم حُذف:** الجدولان `monthly_report_students` و`monthly_report_activities` ونوعُ `activity_key` وأعمدةُ `monthly_reports` القديمة و`app_settings.default_points/default_attendance_days` أُسقطت في `20261019111920_drop_old_report_model` (§8)، فلا أثرَ لها في القاعدة.

### `public.quran_records`

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `report_id` | uuid FK → `monthly_reports` | `on delete cascade`، غير فارغ |
| `student_id` | uuid FK → `students` | `on delete cascade`، غير فارغ |
| `from_surah` / `to_surah` | smallint FK → `surahs(number)` | بداية المسار ونهايتُه (سورة) |
| `from_ayah` / `to_ayah` | smallint | بداية المسار ونهايتُه (آية) |
| `pages_memorized` | smallint | `not null default 0`، `check (between 0 and 604)` — تُملأ محسوبةً من العميل ويعدّلها المعلم |
| `pages_reviewed` | smallint | اختياري، `check (between 0 and 604)` |
| `notes` | text | `check (null or char_length <= 500)` |
| `recorded_by` | uuid FK → `profiles` | `on delete set null`، والافتراضيّ `auth.uid()` |
| `created_at` / `updated_at` | timestamptz | `trg_quran_records_updated_at` يضبط الثاني |

**القيود:** `unique (report_id, student_id)` (سجلٌّ واحد لكلّ طالب في الشهر)؛ `quran_records_positions_all_or_none` (المواضعُ الأربعة كلُّها فارغة = «لم يحفظ جديداً» أو كلُّها معبّأة)؛ `quran_records_pages_need_range` (لا صفحاتِ حفظٍ بلا مدى: `from_surah is not null or pages_memorized = 0`). فهرس: `quran_records_student_idx (student_id)`.

### الحارس `quran_records_guard` ← `private.guard_quran_record()` (`BEFORE INSERT OR UPDATE OR DELETE`، `security definer`، `search_path=''`)

| القاعدة | التفصيل |
|---|---|
| **لا كتابة في شهرٍ معتمَد** | إدراجٌ أو تعديلٌ أو حذفٌ مباشرٌ على سجلّ تقريرٍ `approved` يُرفض: «الشهر معتمَد — يُعيده المعتمِد أوّلاً» (يُفحص تقرير السجلّ القديم ثم الجديد) |
| **حدودُ الآيات** | `from_ayah` و`to_ayah` بين 1 وعدد آيات سورتيهما من `surahs.ayah_count` |
| **ترتيبُ الحفظ** | السورة تنازلياً والآية داخلها تصاعدياً: `from_surah > to_surah` أو (نفس السورة و`from_ayah <= to_ayah`)؛ وإلا «بدايةُ المسار يجب أن تسبق نهايتَه بترتيب الحفظ (من الناس إلى الفاتحة)» |
| **الطالب في حلقة التقرير** | عند الإدراج أو تغيّر الطالب/التقرير: `students.halaqa_id` يطابق `monthly_reports.halaqa_id` وإلا «الطالب ليس في حلقة هذا التقرير» |
| **الحذف التتابعيّ يُتجاوَز** | `pg_trigger_depth() > 1` (حذفُ طالبٍ/تقريرٍ/حلقة) يمرّ حتى في شهرٍ معتمَد؛ المباشرُ يبقى محظوراً |
| **تفريغ `recorded_by`** | تعديلٌ لا يغيّر إلا `recorded_by` يمرّ بلا فحص؛ وفي العمق ≥ ٢ (`on delete set null` عند حذف حساب) يمرّ **قبل فحص الشهر المعتمَد** فلا يعطّل حذفَ حسابٍ سجّل في شهرٍ معتمَد (منذ `20261019110259`) |

### السياسات (4، RLS مفعّل؛ `select, insert, update, delete` لـ`authenticated` وحده، وسُحب الكلُّ من `public` و`anon`)

| السياسة | الشرط |
|---|---|
| `quran_records_read` | `can_view_halaqa(report.halaqa_id)` — **بلا فرع الطالب** (أُسقط في `20261019095659`: الطالب لا يقرأ تقرير حلقته بـRLS فلا ينفع فرعٌ له؛ يقرأ رصده المعتمَد عبر `my_quran_months()` / `my_approved_pages()`) |
| `quran_records_insert` / `_update` / `_delete` | معلّم الحلقة **والتقرير `draft`**، أو `can_approve_report_in_halaqa(halaqa)` (يعدّل المعتمِدُ حتى الاعتماد؛ ويمنعه الحارسُ بعده) |

### `monthly_reports` — ما أُضيف أو تغيّر

- **`return_note`** `text check (null or char_length <= 500)`: ملاحظةُ المعتمِد عند إعادة الرصد إلى المعلم، إلزاميةٌ عند الإعادة.
- **`target_pages_snapshot`** تُملأ عند الإدراج من `app_settings.target_memorization_pages` (مُشغِّل `monthly_reports_target_snapshot` ← `private.monthly_reports_target_snapshot()`، `BEFORE INSERT`، تملأ ما كان فارغاً). **لا تُزوَّر** (منذ `20261019110259`): بيد مستخدمٍ يصفّرها `monthly_reports_flow` عند الإدراج (يسبق `monthly_reports_target_snapshot` أبجدياً فيملؤها من الإعدادات، والهجرةُ تفحص الترتيب)، وعند التحديث تُستعاد القديمة. تُلتقط عند إنشاء رأس الشهر (أول سجلّ يُحفظ) لا عند الإرسال، فلا يغيّرها تعديلُ الإعدادات بأثرٍ رجعيّ. الخدمةُ والهجراتُ (`auth.uid() is null`) تكتبها كما تشاء.
- **`reports_write`** (`for all`): `is_halaqa_teacher(halaqa_id) or can_approve_report_in_halaqa(halaqa_id)` للشرط والفحص معاً — بعد أن كانت `can_approve_in_halaqa` (المدير الفنيّ يقرأ ولا يكتب).
- **`guard_report_status`** (`monthly_reports_guard_status`): المنطقُ القديم نفسُه بدالّة المعتمِد الجديدة: معتمِدُ الحلقة يمرّ؛ غيرُه لا يعدّل بعد الإرسال، ولا يضع حالةً غير `draft`/`submitted`، ولا يمسّ `approved_by/at`. **الحذفُ بعد الإرسال للمدير الإداري وحده** (`current_user_role() is distinct from 'admin_manager'` ← `42501`)؛ المسوّداتُ تُحذف كما كانت.
- **`prevent_future_report_month`** (`trg_reports_no_future`): لا رأسَ لشهرٍ لم يبدأ بعد، والمقارنةُ بـ`private.attendance_today()` (توقيت غزة) لا بـ`current_date` (UTC) منذ `20261019110259`؛ الدالّة `security definer` و`search_path=''`، والرسالة: «لا يمكن إنشاء تقرير لشهر لم يبدأ بعد».

### معتمِدُ الرصد `public.can_approve_report_in_halaqa(hid uuid)`

`language sql stable security definer set search_path = public`، تُرجع true إن وُجدت الحلقة و: دورُ المستدعي `admin_manager`، أو `women_admin` والحلقةُ `female`، أو `field_supervisor` و`halaqat.supervisor_id = auth.uid()`. **المدير الفنيّ false** (يطّلع بـ`can_view_halaqa`). `revoke … from public, anon`، و`grant execute … to authenticated, service_role`. لا تُمسّ `can_approve_in_halaqa` (الإسنادُ وكشفُ الحوافز يعتمدان عليها).

### مسارُ الحالات `monthly_reports_flow` ← `private.monthly_reports_flow()` (`BEFORE INSERT OR UPDATE`، `security definer`، `search_path=''`)

يعمل قبل `monthly_reports_guard_status` أبجدياً ولا يحلّ محلّه. الخدمةُ والهجرات (`auth.uid() is null`) تمرّ.

| الحالة | القاعدة |
|---|---|
| **الإدراج** | مسوّدةً فقط (وإلا «يُنشأ الرصدُ مسوّدةً ثم يُرسَل»)، وتُصفَّر `submitted_at` و`approved_by` و`approved_at` و`return_note` و`target_pages_snapshot` (الأخيرةُ يملؤها مُشغِّل اللقطة) فلا يزوّرها العميل |
| **التحديثُ التتابعيّ** | `pg_trigger_depth() > 1` (مثل `on delete set null` لـ`approved_by` عند حذف حساب) لا يمسّه المسار |
| **لا نقل** | تغيّر `halaqa_id` أو `report_month` أو `report_year` ← «لا يُنقل الرصدُ إلى حلقةٍ أو شهرٍ آخر» |
| **أختام المسار** | `submitted_at` و`approved_by` و`approved_at` و`target_pages_snapshot` تُستعاد دائماً إلى قديمها ثم يضبطها الانتقالُ وحده؛ فالتحديثُ بلا تغيّر حالةٍ يُبقي الأختامَ كما هي |
| **ملاحظةُ الإعادة** | من لا يملك `can_approve_report_in_halaqa` (المعلم) لا يغيّر `return_note` (تُستعاد القديمة) |
| **قائمةٌ بيضاء للانتقالات** | `draft→submitted` و`submitted→approved` و`submitted→draft` و`approved→draft` فقط؛ غيرُها «انتقالٌ غيرُ مسموح» |
| **`draft→submitted` (قفل الشهر)** | لا يُرسَل قبل `private.report_opening_day(سنة, شهر)` = **آخرُ يومٍ في الشهر، والخميس إن كان آخرُه جمعة**؛ مقارنةٌ بـ`private.attendance_today()` (توقيت غزة): «يُرصَد الشهر ابتداءً من DD-MM-YYYY». ثم `submitted_at := attendance_today()` وتُفرَّغ `return_note` |
| **`submitted→approved`** | `approved_by := auth.uid()` و`approved_at := now()` (والصلاحيةُ للحارس) |
| **`submitted\|approved→draft` (إعادة)** | `return_note` إلزاميةٌ غيرُ فارغة وإلا «الإعادةُ تحتاج ملاحظة»؛ وتُصفَّر `approved_by` و`approved_at`. المعتمَدُ يُعاد فتحُه بهذا الطريق |

> **الأيامُ المعروفة:** `report_opening_day(2026, 7)` = 2026-07-30 (آخرُه جمعة)، و`(2026, 10)` = 2026-10-31. المسوّدةُ مفتوحةٌ قبل ذلك للرصد؛ المقفلُ هو الإرسال وحدَه.

### مُنتِجو الإشعارات `monthly_reports_notify_status` ← `private.notify_report_status()`

مُشغِّل `AFTER UPDATE OF status … WHEN (old.status is distinct from new.status)`، يستدعي `private.notify` (§18) ورابطُه `/reports?y=<سنة>&m=<شهر>` (يفتح الشهرَ بعينه؛ يطابق قيدَ رابط الإشعارات `?=&`) ومصدرُه `monthly_reports`، ونصُّه «اسم الحلقة · MM-YYYY»:

| النوع | الحدث | المستلم |
|---|---|---|
| `report_submitted` | الانتقال إلى `submitted` | **مشرفُ الحلقة**؛ وإن لم يكن لها مشرفٌ فالمعتمِدون الاحتياط (المدير الإداري، والمديرة الإدارية إن كانت الحلقة للبنات) — **و**المدير الفنيّ دائماً (يطّلع ولا يعتمد). الاحتياطُ والفنيّ من الحسابات النشطة وحدها |
| `report_approved` | الانتقال إلى `approved` | معلّمُ الحلقة |
| `report_returned` | `submitted\|approved → draft` | معلّمُ الحلقة، والنصُّ «… — <ملاحظة الإعادة>» |

(`private.notify` لا يُشعِر المنادي بفعله هو، فمن أرسل أو اعتمد أو أعاد لا يصله شيء.)

### قراءةُ الطالب لرصده المعتمَد (`security definer`، `search_path=''`، `revoke … from public, anon`، `grant execute … to authenticated`)

| الدالّة | ما تُرجعه |
|---|---|
| `my_approved_pages()` | `bigint`: مجموعُ `pages_memorized` للطالب (`my_student_id()`) في الشهور **المعتمَدة** وحدها |
| `my_quran_months()` | `(report_year, report_month, from_surah, from_ayah, to_surah, to_ayah, pages_memorized, pages_reviewed)` للشهور المعتمَدة وحدها، مرتَّبةً بالأقدم |

المسوّدةُ والمُرسَلُ لا يظهران للطالب ولا في رابطه العام؛ و«وصل N من 30» يُحسب من نهاية آخر شهرٍ **معتمَد** (`program_juz`).

### الفحص الذاتي

الهجرتان تُلغيان نفسيهما عند أيّ خلل: RLS غير مفعّل على `quran_records`، أو السياساتُ ليست 4 (قراءةٌ واحدة)، أو منحٌ ناقص لـ`authenticated` أو زائدٌ لـ`anon`/`PUBLIC`، أو مُشغِّلاتُ `quran_records` (2) و`monthly_reports` (4: flow وnotify_status وtarget_snapshot وguard_status) ناقصة، أو `reports_write` لا تستعمل المعتمِد الجديد، أو `guard_report_status` ما زال يستعمل `can_approve_in_halaqa`، أو `my_approved_pages` ما زالت على الجدول القديم، أو منحُ الدوالّ خطأ، أو `report_opening_day` يخالف 2026-07-30/2026-10-31، أو المديرُ الفنيّ «يعتمد»/لا يقرأ والإداريُّ لا يعتمد (بجلساتٍ حقيقية داخل الكتلة). وتضيف الثانية: المسارُ قبل الإدراج والتحديث وفيه القواعد الثلاث، وحذفُ غير المسوّدة للإداري وحده، وسياسةُ القراءة بلا فرع الطالب، وإشعارُ الاحتياط، واختصارُ `recorded_by` قبل فحص الشهر المعتمَد في حارسَي الحضور.

---

## 22. الاختبارات المرحلية: `exam_cycles` (الدفعة الثانية، الجزء ٣)

> الهجرتان: `20261019121528_exam_cycles` (الجدول والبذرة والحارس والمُنتِجان والدالّة) ← `20261019122626_exam_cycles_hardening` (تحصين التاريخ: لا يُمحى ترشيحٌ مرصود، ونتيجةٌ واحدة لكل ترشيح، واتّساق الدورات، وصياغة الإشعارات بالجنس). كانتا إضافيّتين لا تمسّان `exam_plan`؛ وحذفتها بعدهما `20261019145800_drop_exam_plan` (أدناه). كلُّ هجرةٍ تفحص نفسها في كتلة `do` آخرها. الخطة: `docs/superpowers/plans/2026-10-19-staged-exams.md`.

**الفكرة:** رحلة الاختبار 15 دورةً ثابتة العدد في **ثلاث مراحل × خمس دورات**، تُجتاز **بالترتيب** من الناس صعوداً (لا قفز فوق دورة). كلُّ دورةٍ نطاقُها أجزاءُ برنامجٍ `parts_from`–`parts_to` مرقّمةً بترتيب الحفظ (الجزء 30 = الناس). والدورة الثانية تحوي الأولى، والرابعة تحوي الثالثة، والخامسة تحوي الأربع قبلها (شاملة المرحلة). **حدودُ كلّ دورةٍ بالسورة والآية تُحسب عند العرض من `program_juz` (§19)** ولا تُخزَّن: البداية = بدايةُ الجزء `parts_to` والنهاية = نهايةُ الجزء `parts_from` (فالجزء 13 ينتهي عند يوسف 111).

### الجدول `public.exam_cycles`

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | smallint PK | 1–15 (ثابت) |
| `stage_number` | smallint | 1–3 (`check`) |
| `cycle_number` | smallint | 1–5 (`check`) |
| `parts_from` | smallint | أول جزءٍ في الدورة (برقم البرنامج)؛ `check (1 <= parts_from <= parts_to <= 30)` |
| `parts_to` | smallint | آخر جزء |
| `surahs_label` | text | وصف السور بالعربية («المجادلة – الناس»)؛ غيرُ فارغ (`btrim(...) <> ''`) |
| `sort_order` | smallint **مولَّد ومخزَّن** | `(stage_number − 1) × 5 + cycle_number` — مفتاح الترتيب الوحيد (1–15)، فريد |
| `created_at` / `updated_at` | timestamptz | `set_updated_at` على التعديل |

قيودٌ فريدة: `(stage_number, cycle_number)` و`sort_order`.

**البذرة (15 صفاً؛ الدورة 3/3 «البقرة – النساء» بقرار المواصفة):**

| المرحلة | الدورة 1 | الدورة 2 | الدورة 3 | الدورة 4 | الدورة 5 |
|---|---|---|---|---|---|
| 1 | 28–30 (المجادلة – الناس) | 26–30 (الأحقاف – الناس) | 23–25 (يس – الجاثية) | 21–25 (العنكبوت – الجاثية) | 21–30 (العنكبوت – الناس) |
| 2 | 18–20 (المؤمنون – القصص) | 16–20 (مريم – القصص) | 13–15 (يوسف – الكهف) | 11–15 (يونس – الكهف) | 11–20 (يونس – القصص) |
| 3 | 8–10 (الأعراف – التوبة) | 6–10 (المائدة – التوبة) | 3–5 (البقرة – النساء) | 1–5 (البقرة – النساء) | 1–10 (البقرة – التوبة) |

**الدلالة:** اجتيازُ دورةٍ يحقّق للطالب `31 − parts_from` جزءاً من الناس (الدورة 1/1 ← 3 أجزاء، 1/2 ← 5، 3/5 ← 30).

**RLS:** مُفعَّل. `revoke all … from public, anon, authenticated` **ثم** `grant select` لـ`authenticated`، و`grant update (parts_from, parts_to, surahs_label)` **على هذه الأعمدة الثلاثة وحدها**. سياستان: `exam_cycles_select` (`using (true)` — يقرؤها كلُّ مسجَّل، ومنهم الطالب لرحلته) و`exam_cycles_update` (`admin_manager` و`technical_manager` فقط عبر `current_user_role()`). **لا إدراج ولا حذف من العميل** (العددُ ثابت)؛ و`anon` بلا منح، فالصفحة العامة تقرؤها بالخدمة.

### الحرّاس

حرّاسُ هذا الجزء مفصَّلون في جدول §17: `guard_exam_cycle_edit` (الأجزاء والتسمية وحدها)، و`check_exam_cycles_consistency` (الاحتواء، مؤجَّل)، و`guard_cycle_sequence` (الدورة المستحقّة وترشيحٌ معلّق واحد، بقفلٍ استشاريّ لكل طالب)، و`guard_graded_item` (لا حذف ولا نقل لمرصود)، و`guard_result_link` (لا نقل لنتيجة). وكلُّها `security definer` و`set search_path = ''` و`revoke all … from public, anon, authenticated` (لا تُنفَّذ من العميل). ويحكم على **كلّ كاتبٍ حتى الخدمة**.

### رفعُ الأجزاء `public.bump_parts_on_pass()`

`security definer`، `search_path = public`. بعد إدراج نتيجةٍ ناجحة (أو انتقالِ نتيجةٍ إلى «ناجح» — مُشغِّل التحديث الجديد `exam_results_bump_parts_on_update … when (new.passed and not old.passed)` لتصحيح رصدٍ لاحقاً): `students.quran_parts = 31 − exam_cycles.parts_from` عبر `exam_list_items.exam_cycle_id` (الدورةُ وحدها منذ `20261019145800`؛ حُذف فرعُ `exam_plan.parts_to` القديم). **لا يُنقِص أبداً** (`coalesce(quran_parts, 0) < v_parts`)، فمن اجتاز دورةً أقلّ بعد ما اجتاز أكبر يبقى ما بلغه (اجتيازُ 1/1 لطالبٍ له 8 أجزاء لا يغيّره).

### المُنتِجان (عبر `private.notify` وحدها — §18)

| الاسم | الحدث ← المستلم |
|---|---|
| `exam_list_items_notify_nominated` ← `private.notify_exam_nominated()` | `AFTER INSERT` **على مستوى الجملة** بجدول انتقال `new_items`: إشعارٌ **واحد لكلّ قائمة** (لا لكلّ طالب) لمختبِر الحلقة، `exam_nominated`، رابط `/exams` |
| `exam_results_notify_graded` ← `private.notify_exam_graded()` | `AFTER INSERT` لكل نتيجة: `exam_graded` لمعلّم الحلقة (رابط `/exams`) وللطالب نفسه (رابط `/me`)، بصياغةٍ مؤنّثة للطالبة |

يطلقان **ولو كتب الكودُ القديم** (لا يتوقّفان على العميل). و`private.notify` لا تُشعِر المنادي بفعله هو فمن رشّح أو رصد لا يصله شيء.

### قراءةُ الطالب لنتائجه `public.my_exam_cycle_results()`

`(exam_cycle_id smallint, passed boolean, total_score int, exam_date date)` لكلّ محاولات الطالب نفسه على بنودٍ بدورة (`exam_cycle_id is not null`)، مرتَّبةً بالدورة ثم التاريخ ثم الإنشاء؛ مقصورةٌ على `students.user_id = auth.uid()` فلا يرى غير سجلّه ولا `teacher_note`. `language sql stable security definer`، `search_path = ''`، `revoke … from public, anon`، `grant execute … to authenticated`. تغذّي رحلته في `/me` (يُجمع **النجاحُ يغلب**: لا يُلغى اجتيازٌ برسوب لاحق). أمّا العاملون فيقرؤون `exam_results` ببنودها مباشرةً (RLS).

### حالة البيانات والإزالة اللاحقة

- بياناتُ الاختبار التجريبية (قوائم وبنود ونتائج وإشعاراتها) حُذفت بإذن المستخدم 2026-10-19 بعد التحقّق في المتصفح؛ جداولُ الاختبار فارغة، فلا بنودَ قديمة بلا دورة.
- **حُذفت الخطةُ القديمة 2026-10-19** بالهجرة `20261019145800_drop_exam_plan`: جدول `exam_plan` والنوع `exam_stage_type` والعمود `exam_list_items.exam_plan_id` والمُشغِّل `exam_list_items_guard_sequence` ودالّته `guard_station_sequence()` والدالّة `my_exam_results()` وفرع `exam_plan` في `bump_parts_on_pass`؛ وصار `exam_list_items.exam_cycle_id` **NOT NULL**. تفحص الهجرةُ نفسها (لا أثرَ للنموذج القديم في جدولٍ أو دالّةٍ أو عرض، والمُشغِّلُ `exam_results_bump_parts` قائم). اختبارات RLS لرحلة الطالب (`supabase/tests/v2_rls.sql`، ر-1…ر-4) حُوّلت إلى `exam_cycles` و`my_exam_cycle_results()`.

### الفحص الذاتي

كلتا الهجرتين تُلغيان نفسيهما عند أيّ خلل: عدد الدورات ليس 15، أو `sort_order` غير متّصل 1–15، أو المدى لا يغطّي 1–30، أو تغطيةُ المراحل ليست (21–30، 11–20، 1–10)، أو المنحُ خاطئة (`anon` يقرأ، أو `authenticated` يُدرج/يحذف أو يعدّل `stage_number`)، أو RLS غير مفعّل أو السياستان ناقصتان، أو دوالّ `private` مكشوفةٌ للعميل، أو `my_exam_cycle_results` منحُها خاطئ، أو أيّ من المُشغِّلات الأحد عشر ناقصٌ أو على جدولٍ خاطئ أو معطَّل، أو `uq_exam_results_item` ليس فريداً (أو بقي `idx_exam_results_item`)، أو `bump_parts_on_pass` لا تجمع المسارين، أو صياغةُ الإشعارات لم تُحدَّث، أو البذرة تخالف قاعدة الاتّساق.

**هجرةٌ ثالثة `20261019142657_exam_results_pass_mark_guard`** (إضافيّة): المُشغِّل `exam_results_guard_pass_mark` أعلاه، و`revoke all on exam_lists, exam_list_items, exam_results from anon` — دفاعٌ في العمق (RLS يمنعه أصلاً، والصفحةُ العامة تقرأ بـ`service_role`). وتفحص نفسَها: المُشغِّل قائمٌ على `exam_results`، والدالّةُ غيرُ قابلةٍ للتنفيذ من `anon` و`authenticated`، و`anon` بلا `select` على الجداول الثلاثة، و`authenticated` ما زال يُدرج في `exam_results` و`exam_list_items`. وسلوكُها فُحص قبل التطبيق في معاملةٍ تُلغى (`rollback-ok`): علامةٌ مرسلة 0 صارت قيمةَ الإعدادات، والتعديلُ لا يغيّرها، وطالبٌ مخالف وربطٌ لاحق رُفضا، والإدراجُ بلا العمود يمرّ (القيد `not null` يُفحص بعد المُشغِّل).
