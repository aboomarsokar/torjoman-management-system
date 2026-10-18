# مخطط قاعدة البيانات — ترجمان القرآني

> **مسوّدة أولية مستخرجة من البريف التصميمي.** راجعها قبل التطبيق — التعديل قبل أول migration مجاني.
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
auth.users (Supabase)  ← العاملون الأربعة فقط
    │ 1:1
    ▼
profiles ──────┐
    │           │ (quality_supervisor_id) مشرف ← مشرف جودة
    │           │ (self-reference)
    │
    ├─< halaqat (teacher_id, supervisor_id)   حلقة: معلم + مشرف
    │       │
    │       ├─< students (halaqa_id)           سجلّ بيانات — لا حساب ولا ربط بـ auth.users
    │       ├─< supervision_visits (halaqa_id) زيارات الحلقة
    │       ├─< monthly_reports (halaqa_id)    تقارير الحلقة الشهرية
    │       ├─< halaqa_incentives (halaqa_id)  تخصيص حوافز الحلقة الشهري (المدير)
    │       └─< incentive_statements (halaqa_id) كشف حوافز الحلقة (المعلم)
    │
    ├─< exam_lists (teacher_id)                قوائم الاختبار الأسبوعي
    │       └─< exam_results (exam_list_id, student_id)
    │
    ├─< admin_alerts (issuer_id, teacher_id)   التنبيهات الإدارية
    ├─< meeting_minutes (created_by)           محاضر الاجتماعات
    ├─< monthly_salaries (profile_id)          الرواتب الشهرية المرجعية (المدير)
    └─< financial_transactions (created_by)    الحركات المالية

exam_plan (بيانات مرجعية — يعدّلها المدير)
app_settings (إعدادات المدير القابلة للضبط)
news (الأخبار — المدير ينشرها، عامّة على Landing)
```

---

## 1. `profiles` — العاملون (مدير/مشرف جودة/مشرف/معلم)

يمتدّ من `auth.users`. يخزّن بيانات العاملين الأربعة. الطلاب في جدول منفصل (§2).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `role` | enum | `manager` / `quality` / `supervisor` / `teacher` / `examiner` (المختبِر — يرصد نتائج حلقاته المُسنَدة، منذ 2026-10-15) |
| `full_name` | text | الاسم رباعي |
| `gender` | enum | `male` / `female` |
| `birth_date` | date | العمر يُحسب منه |
| `national_id` | text unique | رقم الهوية (مقنّع للعرض) |
| `marital_status` | text | الحالة الاجتماعية |
| `family_count` | int | عدد الأفراد |
| `job_title` | text | المسمى الوظيفي |
| `hire_date` | date | تاريخ التعيين |
| `years_experience` | int | سنوات الخبرة |
| `quality_supervisor_id` | uuid FK → profiles | للمشرف فقط: مشرف الجودة المسؤول (اختياري) |
| `residence_area` | text | المنطقة/المدينة |
| `nearest_mosque` | text | أقرب مسجد |
| `address_detail` | text | عنوان السكن التفصيلي |
| `education_level` | text | المؤهل التعليمي |
| `academic_major` | text | التخصص الأكاديمي |
| `quran_parts` | int | عدد الأجزاء المثبتة |
| `tajweed_level` | text | الأحكام (التجويد) |
| `phone` | text | رقم الجوال |
| `email` | text | البريد الإلكتروني |
| `status` | enum | `pending` / `active` / `disabled` (تُشتقّ من حالة Auth) |
| `assigned_by` | uuid FK → profiles | «عيّنه» — مَن أنشأ/عيّن هذا الحساب |
| `avatar_url` | text | ⚠️ متروك منذ Task 6b (لا يُقرأ ولا يُكتب) — يُسقط بعد النشر |
| `photo_path` | text | الصورة الشخصية الاختيارية: مسارٌ في المستودع **الخاص** `profile-photos`، شكلُه ثابت `<id>/photo.webp` (قيد `profiles_photo_path_shape`)، و**لا صورة لحساب أنثى**. القراءة بروابط موقَّعة لساعة: لصاحبها ولكل حسابٍ نشطٍ غير طالب (`can_view_profile_photo`)؛ الرفع/الحذف لصاحب المجلّد أو المدير الإداري (`can_manage_profile_photo`). الهجرة `20261018080234_profile_photos.sql` |

**بيانات مالية (🔒 صلاحية المدير فقط — يُفضّل جدول منفصل `profile_financials` بـ RLS صارم):**

| العمود | النوع | ملاحظات |
|---|---|---|
| `profile_id` | uuid FK → profiles | |
| `account_number` | text | رقم الحساب/المحفظة (يقبل رقم جوال) |
| `account_holder` | text | اسم صاحب الحساب |
| `account_type` | enum | `jawwalpay` / `palpay` / `bank_palestine` |

**RLS:**
- `manager`: قراءة/كتابة كل السجلّات.
- `quality`: قراءة/إنشاء/تعديل المعلمين والمشرفين **ضمن نطاقه** (مشرفوه والحلقات تحتهم).
- `supervisor` / `teacher`: قراءة سجلّهم الخاص + التحديث المحدود (الملف الشخصي).
- البيانات المالية للعاملين: `manager` فقط.

---

## 2. `students` — الطلاب

**سجلّ بيانات مجرّد — لا حساب ولا دخول.** منفصل عن `profiles`، و**لا يرتبط بـ `auth.users`** إطلاقاً (الطالب لا يدخل النظام). يُدخل ويُدار من العاملين (المعلم/المشرف/المدير). مرتبط بحلقة.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` — **لا ربط بـ `auth.users`** |
| `full_name` | text | الاسم رباعي |
| `gender` | enum | `male` / `female` |
| `birth_date` | date | العمر يُحسب منه |
| `national_id` | text unique | **معرّف تعريفي فقط (لا دخول)** (فريد، مقنّع للعرض) |
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
| `avatar_url` | text | الصورة الشخصية |

**RLS:** (الطالب ليس دوراً — لا توجد سياسة باسم `student`)
- `manager`: كل الطلاب.
- `quality`: طلاب حلقات مشرفيه.
- `supervisor`: طلاب حلقاته (قراءة + تعديل بيانات).
- `teacher`: طلاب حلقته فقط (قراءة + إنشاء سجلّ + تعديل).

> **نقل طالب:** عند تغيير `halaqa_id` يُحفظ السجلّ الكامل (الاختبارات/الحفظ/الغياب)، وتُحدَّث حالته في الحلقة السابقة إلى `transferred`.

---

## 3. `halaqat` — الحلقات

الكيان المحوري: معلم + طلاب + وقت يومي ثابت.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | اسم الحلقة |
| `daily_time` | time | الوقت اليومي الثابت |
| `teacher_id` | uuid FK → profiles | **إلزامي** — لا حلقة بلا معلم |
| `supervisor_id` | uuid FK → profiles | المشرف المسؤول (اختياري — قد تكون «غير مُسندة») |
| `classification` | enum | `a` / `b` (تصنيف إداري) |
| `gender` | enum | `male` / `female` |
| `status` | enum | `active` / `stopped` |
| `assigned_by` | uuid FK → profiles | «عيّنه» — مَن أسند المشرف |
| `examiner_id` | uuid FK → profiles | المختبِر الذي يرصد اختبارات الحلقة (اختياري؛ مُشغِّل يرفض غير `examiner`) |
| `examiner_assigned_by` | uuid FK → profiles | مَن أسند المختبِر — يملؤه مُشغِّل `stamp_halaqa_examiner` |
| `examiner_assigned_at` | timestamptz | متى أُسند |

> **علاقة مشرف الجودة بالحلقة غير مباشرة:** حلقة → مشرف → مشرف جودة. لا ربط مباشر.

**RLS:**
- `manager`: كل الحلقات (إنشاء/تعديل/إسناد).
- `quality`: حلقات مشرفيه (إسناد لمشرفيه فقط — لا خارج نطاقه).
- `supervisor`: حلقاته (قراءة).
- `examiner`: حلقاته المُسنَدة (قراءة) عبر `is_halaqa_examiner(id)` — دالّة منفصلة عن `can_access_halaqa` كي لا يرث الزيارات والتقارير.
- `teacher`: حلقته (قراءة).

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

**RLS:**
- `manager`: كل الزيارات.
- `quality`: زيارات مشرفيه.
- `supervisor`: زياراته هو فقط (إنشاء/تعديل/رفع نتيجة).

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

**RLS:** قراءة للجميع، **تعديل للمدير (مُنفَّذ في المرحلة 1 — §4.11)**.

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

**RLS:**
- `teacher`: إنشاء/قراءة قوائم حلقته.
- `supervisor`: قراءة القوائم الواردة لحلقاته + تحديث الحالة.
- `examiner`: قراءة قوائم حلقاته المُسنَدة وبنودها.
- `manager` / `quality`: قراءة ضمن النطاق.

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
| `tajweed_score` | int | الأحكام (0–10) — مرة واحدة |
| `total_score` | int | يُحسب آلياً (المجموع = 100) |
| `pass_mark_snapshot` | int | علامة الاجتياز وقت الاعتماد (لا يُعاد احتسابها) |
| `passed` | boolean | مجاز/غير مجاز (محسوب) |
| `notes` | text | ملاحظات |

> الأوزان (10×9 + 10) قابلة للضبط مستقبلاً كقيم ثابتة. **علامة الاجتياز تُخزّن snapshot** لكل نتيجة — تغييرها يسري على اللاحق فقط.

**RLS:** (الطالب ليس دوراً — لا يقرأ نتائجه بنفسه؛ تُعرض ضمن ملف الطالب للعاملين)
- `examiner`: إنشاء نتائج لطلاب حلقاته المُسنَدة باسمه (`examiner_id = auth.uid()`) + قراءتها.
- `supervisor`: قراءة نتائج حلقاته فقط (لم يعد يرصد).
- `teacher`: قراءة نتائج طلابه.
- `manager` / `quality`: قراءة ضمن النطاق.

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
| `monthly_points` | int | النقاط النهائية (محسوبة خارجاً، إدخال الرقم فقط) |
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

**RLS:**
- `teacher`: إنشاء/تعديل تقارير حلقته (يُقفل بعد التسليم).
- `supervisor` / `quality` / `manager`: قراءة (+ اعتماد/إعادة للتعديل) ضمن النطاق.

---

## 9. `meeting_minutes` — محاضر الاجتماعات الإدارية

🔒 المدير فقط (إنشاء واطّلاع).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | العنوان/الموضوع |
| `meeting_date` | date | التاريخ |
| `attendee_ids` | uuid[] | الحاضرون — اختيار من العاملين المؤهّلين (مدير/جودة/مشرف) فقط، لا إدخال حرّ (§4.19) |
| `agenda` | text | جدول الأعمال/البنود |
| `decisions` | text | القرارات المتّخذة |
| `tasks` | text | المهام والمسؤوليات (اختياري) |
| `attachments` | jsonb | مرفقات (اختياري) |
| `status` | enum | `draft` / `final` |
| `created_by` | uuid FK → profiles | |

**RLS:** `manager` فقط (كل العمليات).

---

## 10. `financial_transactions` — الحركات المالية

🔒 المدير فقط. بالشيكل (₪).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | uuid PK | |
| `transaction_date` | date | التاريخ |
| `description` | text | البيان/الوصف |
| `category` | text | التصنيف (رواتب/حوافز/تشغيل/تبرعات… قابل للتوسعة) — تُرحَّل إليه الرواتب وحوافز الحلقات |
| `type` | enum | `income` (وارد) / `expense` (صادر) |
| `amount` | numeric | المبلغ |
| `created_by` | uuid FK → profiles | |

> **الرصيد المتبقّي محسوب** (السابق + الوارد − الصادر) — لا يُخزّن، يُحسب عند العرض أو عبر view.

**RLS:** `manager` فقط (كل العمليات).

---

## 11. `admin_alerts` — التنبيهات الإدارية للمعلمين

المُصدِر: مشرف/مشرف جودة/مدير. المُستقبِل: المعلم.

> **تمييز عن الإشعارات التشغيلية (جرس §4.2):** هذا الجدول لـ«التنبيهات الإدارية» التي يُصدرها العاملون للمعلمين عند المخالفة (كيان مخزَّن). أمّا **جرس الإشعارات التشغيلية** (زيارة متأخرة، تقرير بانتظار الاعتماد، قائمة اختبار وردت) فيُشتقّ **محسوباً** من حالات `supervision_visits` / `monthly_reports` / `exam_lists` — **لا جدول `notifications` في المرحلة 1/2**. مركز الإشعارات الموحّد الدائم (بحالة مقروء/غير مقروء) مؤجّل للمرحلة 3 (§8).

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

**RLS:**
- `manager` / `quality` / `supervisor`: إنشاء (ضمن النطاق) + قراءة ما أصدروه.
- `teacher`: قراءة تنبيهاته + تحديث الحالة (الإقرار).

---

## 12. `app_settings` — إعدادات المدير القابلة للضبط

صف واحد (أو key-value) للثوابت التي يضبطها المدير.

| العمود | النوع | الافتراضي | ملاحظات |
|---|---|---|---|
| `id` | int PK | 1 | صف واحد |
| `pass_mark` | int | 80 | علامة اجتياز الاختبار |
| `target_memorization_pages` | int | 30 | صفحات الحفظ المستهدفة |
| `default_points` | int | 100 | النقاط الافتراضية |
| `default_attendance_days` | int | — | أيام الدوام الافتراضي (مقام الانتظام) |

**RLS:** قراءة للجميع، كتابة للمدير فقط.

---

## 13. `news` — الأخبار (§4.26)

وحدة أخبار المدير، تُعرض للزوّار على Landing (أحدث 3).

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

**RLS:** قراءة عامّة للمنشور (زوّار)، إنشاء/تعديل **للمدير فقط**.

---

## 14. `monthly_salaries` — الرواتب الشهرية المرجعية (§4.20ج)

🔒 المدير فقط. الرواتب متفاوتة شهرياً — تُقيَّد للمرجع، مع اعتماد/قفل لكل شهر.

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

**RLS:** `manager` فقط (كل العمليات).

---

## 15. `halaqa_incentives` — تخصيص حوافز الحلقات الشهري (§4.20د)

🔒 المدير فقط. المبلغ المخصّص لكل حلقة في كل شهر، مع اعتماد/قفل لكل شهر. يصل المعلم للقراءة فقط في كشفه.

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

**RLS:** كتابة `manager` فقط؛ قراءة المبلغ المخصّص يتيحها المعلم لحلقته (للعرض في كشفه).

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
| `reviewed_by` | uuid FK → profiles | المدير الذي أقرّ «تمّ الاطّلاع» |
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

**RLS:**
- `teacher`: إنشاء/تعديل كشوف حلقته (يُقفل بعد التسليم) + قراءة `received_amount` من §15.
- `manager`: قراءة كل الكشوف + تحديث الحالة إلى `reviewed`.

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

## دوال النطاق (Scope) — مقترح بنيوي

لتفادي ازدواج منطق الصلاحيات، يُفضّل دالة نطاق واحدة (`supProfile` في البريف) تقرأ خريطة التنظيم (مشرف جودة ← مشرفون ← حلقات ← معلم/طلاب) وتغذّي الفلاتر و RLS معاً. يُنفّذ كـ Postgres function أو composable مُنمّط (`useScope`).

---

> **تذكير:** هذه مسوّدة. عند الاستقرار → أول migration → تتحوّل لمصدر حقيقة حيّ يُحدَّث مع كل migration لاحق.

> **profiles.must_change_password** (boolean, default false): يُضبط true عند إنشاء حساب عامل بالكلمة الافتراضية، ويصير false بعد تغيير العامل كلمته. (migration 20260624130000)
