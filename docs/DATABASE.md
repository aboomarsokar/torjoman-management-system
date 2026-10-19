# مخطط قاعدة البيانات — ترجمان القرآني

> **الحالة (2026-10-19):** يطابق الهجرات حتى `20261019081750_notify_alerts_visits` — أساس الإصدار الثاني: ثمانية أدوار، النطاق في الدور (لا عمود `section`)، دخولٌ بالرقم الوظيفي/الهوية، حساب لكل طالب، صورة شخصية، وإشعاراتُ الأحداث داخل المنصّة (§18). قراءة الأقسام بالترتيب: §1 `profiles` ← §2 `students` ← §17 الأدوار ودوالّ النطاق والحرّاس والمستودعات ← §18 الإشعارات.
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
    │       ├─< monthly_reports (halaqa_id)    تقارير الحلقة الشهرية
    │       ├─< halaqa_incentives (halaqa_id)  تخصيص حوافز الحلقة الشهري (المدير الإداري)
    │       └─< incentive_statements (halaqa_id) كشف حوافز الحلقة (المعلم)
    │
    ├─< exam_lists (teacher_id)                قوائم الاختبار الأسبوعي
    │       └─< exam_results (exam_list_id, student_id)
    │
    ├─< admin_alerts (issuer_id, teacher_id)   التنبيهات الإدارية
    ├─< notifications (recipient_id)           إشعارات الأحداث — تكتبها مُشغّلات، ويقرؤها صاحبها وحده (§18)
    ├─< meeting_minutes (created_by)           محاضر الاجتماعات
    ├─< monthly_salaries (profile_id)          الرواتب الشهرية المرجعية (المدير الإداري)
    └─< financial_transactions (created_by)    الحركات المالية

exam_plan (بيانات مرجعية — يعدّلها المدير الإداري والمدير الفني)
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
| `executed_at` | timestamptz | تاريخ التنفيذ الفعلي (يُقارن آلياً) |
| `status` | enum | `scheduled` / `done` / `late` / `missed` |
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

> **مؤشر الالتزام:** `executed_at` مقابل `scheduled_at` → في وقتها / متأخرة. الالتزام = (في وقتها) ÷ (المستحقّة) × 100.

**RLS** (`visits_*` و`reschedule_*`):
- **القراءة:** `can_view_halaqa(halaqa_id)` (فالمديرة تقرأ زيارات البنات بلا كتابة).
- **الإدراج:** `can_manage_halaqa` (المديران)، أو المشرف الميداني **المسؤول عن تلك الحلقة** (`supervisor_id = auth.uid()` و`is_halaqa_supervisor`).
- **التعديل:** صاحب الزيارة (`supervisor_id`) أو المديران؛ و`with check` يعيد فحص الحلقة الجديدة فلا تُنقل زيارةٌ إلى حلقةٍ خارج نطاقه. **الحذف:** المديران.

---

## 5. `exam_plan` — خطة الاختبارات (بيانات مرجعية ثابتة)

6 مجموعات، لكل مجموعة مستويان (مرحلي 3 أجزاء + تجميعي 5 أجزاء). يعدّلها المدير من شاشة الخطة (§4.11).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | int PK | |
| `group_number` | int | 1–6 |
| `stage_type` | enum | `partial` (مرحلي) / `cumulative` (تجميعي) |
| `parts_from` | int | بداية النطاق (جزء) |
| `parts_to` | int | نهاية النطاق (جزء) |

البيانات الأولية (seed):

| المجموعة | مرحلي | تجميعي |
|---|---|---|
| 1 | 1–3 | 1–5 |
| 2 | 6–8 | 6–10 |
| 3 | 11–13 | 11–15 |
| 4 | 16–18 | 16–20 |
| 5 | 21–23 | 21–25 |
| 6 | 26–28 | 26–30 |

**RLS:** قراءة لكل حساب مسجَّل؛ **الكتابة** `admin_manager` و`technical_manager` (§4.11).

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
| `exam_plan_id` | int FK → exam_plan | النطاق المُحدَّد من المعلم |
| `teacher_note` | text | ملاحظة اختيارية |

**RLS** (`lists_*` و`items_*`):
- **القراءة:** `can_view_halaqa(halaqa_id)` لكل من يرى الحلقة (البنود عبر قائمتها).
- **إنشاء القائمة:** المعلم لحلقته فقط (`teacher_id = auth.uid()` و`is_halaqa_teacher`).
- **تحديث القائمة (الحالة):** المديران أو مختبِر الحلقة. **حذفها:** المديران أو المعلم صاحبها.
- **البنود:** يكتبها معلّم الحلقة أو المديران (`can_manage_halaqa`).

---

## 7. `exam_results` — نتائج اختبار الطالب

المختبِر يُدخل النتيجة (منذ 2026-10-15؛ قبلها المشرف). المجموع = 100. عند الاجتياز يرفع مُشغِّل `bump_parts_on_pass` قيمة `students.quran_parts` إلى نهاية نطاق المحطة (لا يُنقِصها). الاجتياز عند علامة قابلة للضبط (افتراضي 80%).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `exam_list_item_id` | uuid FK → exam_list_items | |
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
| `total_score` | int | يُحسب آلياً (المجموع = 100) |
| `pass_mark_snapshot` | int | علامة الاجتياز وقت الاعتماد (لا يُعاد احتسابها) |
| `passed` | boolean | مجاز/غير مجاز (محسوب) |
| `notes` | text | ملاحظات |

> الأوزان (10×9 + 10) قابلة للضبط مستقبلاً كقيم ثابتة. **علامة الاجتياز تُخزّن snapshot** لكل نتيجة — تغييرها يسري على اللاحق فقط.

**RLS** (`results_*`):
- **القراءة:** الطالب نتائجه (`student_id = my_student_id()`)، ومن يرى حلقة الطالب (`can_view_halaqa`) — المشرف الميداني والمعلم قارئان.
- **الإدراج:** المديران، أو المختبِر لطلاب حلقاته باسمه (`examiner_id = auth.uid()` و`is_halaqa_examiner`).
- **التعديل:** الراصد نفسه أو المديران؛ و`with check` يعيد فحص النطاق على الطالب الجديد فلا تُحوَّل نتيجةٌ إلى طالبٍ خارج حلقات المختبِر. **الحذف:** `admin_manager` وحده.
- ⚠️ سياستا `exam_list_items`/`monthly_reports` لا يجتازهما الطالب (`can_view_halaqa`)، فتضمينُهما يصله `null` — لذلك تقرأ رحلته بالدالّتين `my_exam_results()` و`my_approved_pages()` (§17).

---

## 8. `monthly_reports` — التقرير الشهري للحلقة

المعلم يسلّم تقريراً شهرياً: بيانات الحلقة + سجلّ كل طالب.

**مستوى التقرير:**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `halaqa_id` | uuid FK → halaqat | |
| `report_month` | int | الشهر |
| `report_year` | int | السنة |
| `submitted_at` | date | تاريخ التسليم (للتدقيق) |
| `actual_days` | int | أيام الدوام الفعلي (إدخال المعلم) |
| `default_days_snapshot` | int | أيام الدوام الافتراضي (من إعدادات المدير، للقراءة) |
| `default_points_snapshot` | int | مجموع النقاط الافتراضي (من إعدادات المدير) |
| `target_pages_snapshot` | int | صفحات الحفظ المستهدفة شهرياً (من إعدادات المدير، للقراءة) |
| `attendance_rate` | numeric | نسبة الانتظام (الفعلي ÷ الافتراضي، محسوبة) |
| `activities_done` | int | الأنشطة المصاحبة المنفّذة (محسوب من `monthly_report_activities`) |
| `activities_total` | int | إجمالي الأنشطة (15 — قائمة ثابتة) |
| `general_notes` | text | ملاحظات عامة على الحلقة (تُصدَّر في Excel) |
| `activities_notes` | text | ملاحظات عامة على الأنشطة المصاحبة |
| `status` | enum | `draft` / `submitted` / `approved` |
| `approved_by` | uuid FK → profiles | مَن اعتمد التقرير (للتدقيق) |
| `approved_at` | timestamptz | تاريخ الاعتماد (مستقل عن شهر التقرير) |

> **قيود إلزامية (§4.17):** (١) **تفرّد** — `UNIQUE (halaqa_id, report_month, report_year)`: تقرير واحد لكل حلقة لكل شهر. (٢) **منع الأشهر المستقبلية** — تحقّق (`CHECK`/خادمي) يمنع إنشاء تقرير لشهر لم يبدأ. (٣) الشهر يُقفل بعد التسليم.

**`monthly_report_students` — سجلّ كل طالب في التقرير:**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `report_id` | uuid FK → monthly_reports | |
| `student_id` | uuid FK → students | |
| `memorization_from` | int | الحفظ الجديد: من (رقم صفحة) |
| `memorization_to` | int | الحفظ الجديد: إلى (رقم صفحة) — تحقّق: إلى ≥ من |
| `memorization_pages` | int | صفحات الحفظ = (إلى − من)، محسوب |
| `review_to` | int | المراجعة: إلى (من = «من» الحفظ تلقائياً) |
| `review_pages` | int | صفحات المراجعة = (review_to − memorization_from)، محسوب |
| `absence_excused` | int | غياب بعذر (يوقف عدّاد الزمن) |
| `absence_unexcused` | int | غياب بغير عذر (يُحتسب) |
| `monthly_points` | int | **مُلغى 2026-10-19** — لا يُعرض ولا يُكتب، ولا يدخل الدرجة (الدرجة = أكاديمي 75% + انتظام 25%). يبقى للبيانات القديمة |
| `student_grade` | numeric | درجة الطالب = أكاديمي 60% + انتظام 20% + نقاط 20% (محسوبة) |
| `notes` | text | ملاحظات على الطالب |

**`monthly_report_activities` — الأنشطة المصاحبة (15 نشاطاً ثابتاً لكل تقرير):**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `report_id` | uuid FK → monthly_reports | |
| `activity_key` | enum (أو text + CHECK) | **معرّف ثابت** من قائمة مغلقة (ليس نصّاً حرّاً) — القيم الـ15 أدناه |
| `done` | boolean | تم / لم يتم (افتراضي `false`) |
| `note` | text | ملاحظة سطرية — تظهر/تُملأ فقط عند «لم يتم» |

**كيف يُخزَّن:** صفّ واحد لكل نشاط ⇐ **15 صفّاً لكل تقرير**. يُدرَج الـ15 تلقائياً عند إنشاء التقرير (`done=false`) ثم يبدّلها المعلم (upsert). عدّاد «تمّ X من 15» = `COUNT(*) WHERE done`.

**المفاتيح الـ15 الثابتة (القيمة في القاعدة ← المعنى المعروض):** اللابل العربي **لا يُخزَّن** — يُربط بالمفتاح عبر constants في الكود (`app/constants/`)، لثبات السجلّات لو تغيّرت الصياغة لاحقاً.

| `activity_key` | النوع | المعروض |
|---|---|---|
| `reflection_1` … `reflection_4` | أسبوعي | اللقاء التدبري 1–4 |
| `weekly_review_1` … `weekly_review_4` | أسبوعي | المراجعة الأسبوعية 1–4 |
| `edu_curriculum_1` … `edu_curriculum_4` | أسبوعي | المقرر التربوي 1–4 |
| `video_lecture` | شهري | المحاضرة المرئية |
| `values_followup` | عام | متابعة القيم التربوية |

> **قيود إلزامية:** `UNIQUE (report_id, activity_key)` (لا تكرار نشاط في تقرير) + حصر `activity_key` بالقائمة المغلقة (enum أو CHECK). القائمة الثابتة 15 نشاطاً (§4.17ج). الملاحظة العامة على الأنشطة تُحفظ في `monthly_reports.activities_notes` لا هنا.

> **التكامل:** الغياب بعذر هنا يغذّي مؤشر التقدّم الزمني (§4.18). إنجاز الحلقة = (متوسط الطلاب × 0.8) + (نسبة الأنشطة × 0.2).

**RLS** (`reports_*` و`rstudents_*` و`ractivities_*`):
- **القراءة:** `can_view_halaqa(halaqa_id)`؛ والطالب سطره في `monthly_report_students` (`student_id = my_student_id()`).
- **الكتابة:** معلّم الحلقة أو نطاق الاعتماد (`can_approve_in_halaqa`: المديران + المديرة لحلقات البنات). أسطر الطلاب والأنشطة يكتبها المعلم **ما دام التقرير `draft`** فقط.
- **الحارس `guard_report_status`** (§17): المعلم ينقل `draft→submitted` ويعدّل ما دام مسودّة؛ `approved` وحقول `approved_by/at` لنطاق الاعتماد وحده؛ وبعد الإرسال لا تعديل ولا حذف إلا بيد من يعتمد.

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
| `default_points` | int | 100 | **مُلغى 2026-10-19** (النقاط أُلغيت من التقرير والدرجة) — لا يُعرض ولا يُضبط |
| `default_attendance_days` | int | — | أيام الدوام الافتراضي (مقام الانتظام) |

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
| `created_by` | uuid FK → profiles | المعلم |

**`incentive_statement_items` — بنود المصروفات (صف لكل بند):**

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `statement_id` | uuid FK → incentive_statements | |
| `description` | text | الوصف/البيان |
| `category` | text | جوائز / أنشطة / ضيافة / أخرى |
| `amount` | numeric | المبلغ (₪) |
| `item_date` | date | التاريخ |

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
| `can_assign_in_halaqa(hid)` | **إسناد الطلاب وإخراجهم:** نطاق الاعتماد + المشرف الميداني لحلقاته |
| `is_halaqa_teacher(hid)` / `is_halaqa_examiner(hid)` / `is_halaqa_supervisor(hid)` | الإسناد المباشر (المعلم والمختبِر وهذا الأخير للمشرف الميداني فقط)؛ المعلم والمختبِر يشترطان حساباً نشطاً |
| `my_student_id()` / `my_halaqa_id()` | سجلّ الطالب وحلقته من `students.user_id = auth.uid()` |
| `my_exam_results()` | **رحلة الطالب:** `(exam_plan_id, passed, total_score, exam_date)` لنتائج الطالب نفسه (مقصورة على `my_student_id()`، بلا `teacher_note`) |
| `my_approved_pages()` | مجموع `memorization_pages` من تقارير حلقته **المعتمدة** وحدها |
| `can_view_profile_photo(folder)` / `can_manage_profile_photo(folder)` | سياسات مستودع الصور (§ المستودعات) |
| `claim_employee_number()` | `nextval` من `employee_number_seq` (يبدأ 1001، حدّه 9999) — **للخدمة وحدها** (`grant … to service_role` فقط، مسحوب من `authenticated`) |

> سبب `my_exam_results()` و`my_approved_pages()`: الطالب لا يجتاز سياستَي `exam_list_items` و`monthly_reports` (`can_view_halaqa`) فتصله التضمينات `null` — محطّاتٌ مجتازة تظهر «مستحقّة» وصفحاتُ الحفظ المعتمدة صفر. الدالّتان تفتحان له سطوره وحدها دون فتح الجدولين (`20261018083507`).

### الحرّاس (مُشغِّلات `SECURITY DEFINER`؛ الخدمة والهجرات `auth.uid() is null` تمرّ دائماً)

| المُشغِّل ← الدالّة | ما يحرسه |
|---|---|
| `profiles_guard_privileged` ← `guard_profile_privileged` | `role`/`status`/`employee_number`/**`gender`** للمدير الإداري وحده؛ و`must_change_password`: صاحبه يطفئه فقط (`true→false`) ولا يرفعه إلا المدير الإداري أو الخدمة |
| `students_guard_assignment` ← `guard_student_assignment` | `user_id`/`gender`/`national_id`/`view_token` للمدير الإداري وحده؛ الإخراج من حلقةٍ يحتاج `can_assign_in_halaqa` فيها؛ الإدخال إلى حلقةٍ يحتاجه وتطابقَ جنس الطالب وجنس الحلقة (`23514`) |
| `monthly_reports_guard_status` ← `guard_report_status` | المعلم: `draft→submitted` وتعديل المسودّة فقط؛ `approved` وحقلا `approved_by/at` ولا حذف/تعديل بعد الإرسال إلا لنطاق الاعتماد |
| `incentive_statements_guard_status` ← `guard_statement_status` | مثله لـ`reviewed` وحقلَي `reviewed_by/at` — لكن بنطاق `can_review_statement_in_halaqa` (المدير الإداري، والمديرة الإدارية للبنات؛ **بلا المدير الفني** منذ هجرة `20261019082403`)، والقراءة `can_view_statements_in_halaqa` (معلم الحلقة، مشرف المشروع، المراجِع) |
| `admin_alerts_guard_update` ← `guard_alert_update` | المعلم المعنيّ لا يغيّر إلا الحالة ووقت الإقرار؛ المُصدِر والمدير الإداري يغيّران المحتوى |
| `profiles_photo_clear_on_female` ← `clear_photo_on_female` | حين يصير الحسابُ أنثى يُفرغ `photo_path` آلياً (بدل خطأ `23514` على المدير) |
| `students_sync_gender_to_profile_ins/_upd` ← `sync_student_gender_to_profile` | يزامن `profiles.gender` لحساب الطالب من `students.gender` |
| `halaqat_guard_staff` ← `guard_halaqa_staff` | **لكل كاتبٍ حتى الخدمة:** جنس الحلقة مطلوب؛ المعلم (`teacher`) والمشرف (`field_supervisor`) والمختبِر من جنسها؛ المعلم على حلقةٍ نشطة واحدة (يُفحص عند تغيّر المعلم أو تفعيل الحلقة فقط)؛ لا يتغيّر جنس حلقةٍ فيها طلاب من الجنس الآخر؛ ويختم `assigned_by` بالمستدعي عند الإنشاء وتغيير المعلم/المشرف (`23514`) |
| `profiles_guard_gender_vs_halaqat` ← `guard_staff_gender_vs_halaqat` | لا يتغيّر جنس موظفٍ هو في طاقم حلقةٍ من الجنس الآخر |
| `exam_list_items_guard_sequence` ← `guard_station_sequence` | **لكل كاتب:** لا يُرشَّح طالبٌ لمحطة قبل اجتياز كل محطةٍ قبلها — الترتيب بـ`exam_plan.parts_to` تصاعدياً (لا بالمعرّف)؛ يُفحص عند الإدراج وتغيير المحطة أو الطالب (`23514`). ⚠️ يتغيّر مفتاح الترتيب إن قُلبت الخطة لتبدأ من الناس |
| `supervision_visits_guard_visitor` ← `guard_visit_visitor` | **لكل كاتب:** الزائر المشرف الميداني المُسنَد للحلقة نفسها (منذ `20261019091015`؛ كان يقبل المديرَين)؛ يُفحص عند الإنشاء وتغيير الحلقة أو الزائر فقط (`23514`). والسياسات: الإدراج والتعديل وسجلّ إعادة الجدولة لصاحب الزيارة، والحذف له وللمدير الإداري، والقراءة `can_view_halaqa` |

> المُشغِّلان `admin_alerts_notify` و`supervision_visits_notify` ليسا حرّاساً: هما مُنتِجا الإشعارات (§18).

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

> **حالة البيانات:** بيانات الاختبار حُذفت 2026-10-18 (بقي `exam_plan` و`app_settings`)، والحساب الأول `1001` للمدير الإداري — كلمة مروره لا تُكتب في أي ملف. الاستيراد من Excel مؤجَّل: سيُدخل المستخدم الطلاب بمساعدة Claude.

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

**أنواع `kind` (العشرة):** `report_submitted` · `report_approved` · `report_returned` (الجزء ٢) · `alert_issued` · `visit_scheduled` (**مُنتَجان الآن**) · `exam_nominated` · `exam_graded` (الجزء ٣) · `transport_paid` (الجزء ٤) · `impersonation_started` · `impersonation_write` (الجزء ٥). القيد يحملها كلّها من اليوم، ومُنتِجُها يُضاف مع جزئه.

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
| `admin_alerts_notify` | مُشغِّل `AFTER INSERT ON admin_alerts FOR EACH ROW` | ← `private.notify_alert_issued()` |
| `supervision_visits_notify` | مُشغِّل `AFTER INSERT ON supervision_visits FOR EACH ROW` | ← `private.notify_visit_scheduled()` |

> المُشغِّلان بعد الإدراج (`AFTER`) فلا يغيّران الصفّ الأصليّ، ويعيدان `null`. دوالّهما `security definer` وبلا منحٍ للعميل.

### الفحص الذاتي للهجرة الأولى

تُلغي الهجرة نفسها إن خالف الواقعُ المقصود: RLS غير مفعّل، أو سياسةُ كتابةٍ غير مقصودة، أو منحُ القراءة ناقص، أو منحُ كتابةٍ زائد، أو `private.notify` مكشوفةٌ للعميل، أو `mark_notifications_read` غير قابلة للتنفيذ، أو الجدول خارج `supabase_realtime`. والثالثة (`notify_hardening`) تتحقّق أن `private.notify` موجودة وأنها `security definer` وغير قابلة للتنفيذ من `authenticated` و`anon`. والثانية تتحقّق من وجود المُشغِّلين ومن أن دوالّ الإشعار غير قابلة للتنفيذ من `authenticated`.
