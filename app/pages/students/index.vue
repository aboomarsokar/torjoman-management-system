<script setup lang="ts">
/**
 * دليل الطلاب (§4.23) — لكل طالب حساب يدخل به برقم هويته.
 * قائمة + إضافة/تعديل/حذف وإسناد للحلقة، تصفية بالحالة والحلقة.
 * الإضافة للمدير الإداري وحده عبر POST /api/students (ينشئ الحساب في الخطوة نفسها)،
 * والإسناد (الحلقة) لمن يملكه في نطاقه (canAssign)، والمعلّم يعدّل بيانات طلاب حلقته فقط.
 * الهوية والجنس للمدير الإداري وحده (حارس القاعدة)، والحذف له.
 * الحذف وتصحيح الهوية عبر مسارَي الخادم (يمسّان حساب الدخول نفسه)، والكلمة المؤقّتة تظهر مرّةً واحدة بعد الإضافة.
 */
import { PROJECT_START_DATE } from '~/constants/project'
import type { Database } from '~/types/database.types'
import { studentCredentials, type AccountCredentials } from '~/composables/useAccountAdmin'
import { IDENTITY_ERROR, isValidIdentity, normalizeDigits } from '~/constants/identity'
import { displayPhotoPath } from '~/constants/profilePhoto'
import { choiceItems, RESIDENCE_AREAS } from '~/constants/profileChoices'
import { studentSplitStats, studentStats } from '~/utils/pageStats'
import { gazaToday } from '~/utils/reportWindow'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الطلاب — ترجمان' })

type Gender = Database['public']['Enums']['gender_type']
type StudentStatus = Database['public']['Enums']['student_status']
type StudentRow = Database['public']['Tables']['students']['Row'] & {
  halaqa: { name: string, teacher: { full_name: string } | null } | null
}
type HalqaOpt = { id: string, name: string, gender: Gender, daily_time: string | null, teacher: { full_name: string } | null }

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()

const { isAdmin, canAssign, isTeacher, isReadOnly, isWomenAdmin } = usePermissions()
/** التعديل: من يملك الإسناد في نطاقه أو معلّم الحلقة — لا مشرف المشروع. */
const canManage = computed(() => !isReadOnly.value && (canAssign.value || isTeacher.value))
const canCreate = isAdmin
const canDelete = isAdmin
const HALQA_NONE = 'none'

// ── القائمةُ من الخادم صفحةً صفحة (طلب المستخدم 2026-10-25) ──
// يجلب المتصفّحُ عشرين طالباً، والصفحةُ التالية عشرين أخرى؛ والبحثُ والحالةُ والحلقةُ شروطٌ على الخادم.
// والأرقامُ (البطاقات وعددُ كلّ حالة) من استعلامٍ خفيفٍ منفصل: خمسةُ أعمدةٍ بلا ربطٍ لطلاب النطاق كلِّهم.
const PAGE_SIZE = 20
type StatsRow = Pick<StudentRow, 'id' | 'gender' | 'status' | 'enrollment_date' | 'quran_parts' | 'halaqa_id'>
const { data: statsRows, refresh: refreshStats } = useLazyAsyncData<StatsRow[]>('students-stats', async () => {
  const { data, error } = await supabase.from('students').select('id, gender, status, enrollment_date, quran_parts, halaqa_id')
  if (error) {
    console.error('[students] فشل جلب الأرقام:', error.message)
    return []
  }
  return data ?? []
}, { server: false, default: () => [] })

const statusF = ref<StudentStatus | 'all'>('all')
const halqaF = ref<string>('all')
// البحث بالاسم أو رقم الهوية (يقبل الأرقام العربية وأشكال الألف — `serverSearchClauses`) بعد توقّف الكتابة
const query = ref('')
const searchQ = ref('')
const page = ref(1)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    searchQ.value = q
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const { data: pageData, refresh: refreshPage, pending } = useLazyAsyncData('students-page', async () => {
  let q = supabase.from('students').select('*, halaqa:halaqa_id(name, teacher:teacher_id(full_name))', { count: 'exact' })
  if (statusF.value !== 'all') q = q.eq('status', statusF.value)
  if (halqaF.value !== 'all') q = q.eq('halaqa_id', halqaF.value)
  for (const clause of serverSearchClauses(searchQ.value, 'full_name', 'national_id')) q = q.or(clause)
  const from = (page.value - 1) * PAGE_SIZE
  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + PAGE_SIZE - 1)
    .returns<StudentRow[]>()
  if (error) {
    console.error('[students] فشل الجلب:', error.message)
    return { rows: [] as StudentRow[], total: 0 }
  }
  return { rows: data ?? [], total: count ?? 0 }
}, { server: false, default: () => ({ rows: [] as StudentRow[], total: 0 }), watch: [page, statusF, halqaF, searchQ] })
const rows = computed(() => pageData.value?.rows ?? [])
const total = computed(() => pageData.value?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
// تغييرُ الفلتر يعيد الصفحةَ الأولى في اللحظة نفسها (sync) — فيُجلب مرّةً واحدة لا الصفحةَ القديمة ثم الأولى
watch([statusF, halqaF], () => {
  page.value = 1
}, { flush: 'sync' })
watch(pageCount, (pc) => {
  if (page.value > pc) page.value = pc
})
/** بعد إضافةٍ أو تعديلٍ أو حذف: الصفحةُ والأرقامُ معاً. */
async function refresh() {
  await Promise.all([refreshPage(), refreshStats()])
}

const { data: halqat } = useLazyAsyncData<HalqaOpt[]>('students-halqat', async () => {
  const { data } = await supabase
    .from('halaqat')
    .select('id, name, gender, daily_time, teacher:teacher_id(full_name)')
    .order('name')
    .returns<HalqaOpt[]>()
  return data ?? []
}, { server: false, default: () => [] })
function halqaLabel(h: HalqaOpt) {
  return h.teacher?.full_name ? `${h.name} — ${h.teacher.full_name}` : h.name
}
// قائمة الإسناد: تفاصيل كاملة لتمييز الحلقة. قائمة التصفية: الاسم فقط (أوجز).
// قائمة الإسناد مقصورة على حلقات جنس الطالب المختار (جنس الطالب يطابق جنس الحلقة)
const halqaItems = computed(() => [
  { label: 'بلا حلقة', value: HALQA_NONE },
  ...(halqat.value ?? []).filter(h => h.gender === form.gender).map(h => ({ label: halqaLabel(h), value: h.id }))
])
const halqaFilterItems = computed(() => [{ label: 'كل الحلقات', value: 'all' }, ...(halqat.value ?? []).map(h => ({ label: h.name, value: h.id }))])

function countFor(key: StudentStatus | 'all') {
  const list = statsRows.value ?? []
  return key === 'all' ? list.length : list.filter(s => s.status === key).length
}
// قائمةٌ منسدلة بالعدد بجانب كلّ حالة (كانت خمسةَ أزرارٍ تأخذ سطرين على الجوال — طلب المستخدم 2026-10-19)
const statusFilterItems = computed(() => ([
  { value: 'all' as const, label: 'كل الحالات' },
  { value: 'active' as const, label: 'نشط' },
  { value: 'withdrawn' as const, label: 'منقطع' },
  { value: 'graduated' as const, label: 'متخرّج' },
  { value: 'transferred' as const, label: 'منقول' }
]).map(c => ({ value: c.value, label: `${c.label} (${countFor(c.value)})` })))
/** الرقمُ المتسلسل عبر الصفحات لا داخلَ الصفحة وحدها (طلب المستخدم 2026-10-22). */
const seq = (index: number) => (page.value - 1) * PAGE_SIZE + index + 1
const seesBoth = computed(() => isAdmin.value || isReadOnly.value)
/** أرقامُ الحلقة المختارة (لا تتبع البحثَ ولا الحالة: تعرض الحالاتِ نفسَها). */
const scopeStats = computed(() => (statsRows.value ?? []).filter(s => halqaF.value === 'all' || s.halaqa_id === halqaF.value))
const splitStats = computed(() => studentSplitStats(scopeStats.value, gazaToday()))
const stats = computed(() => studentStats(scopeStats.value, gazaToday(), isWomenAdmin.value))
function clearStudentFilters() {
  query.value = ''
  searchQ.value = ''
  statusF.value = 'all'
  halqaF.value = 'all'
}
/** لا طلابَ في النطاق أصلاً — غيرُ «لا نتائج لهذا البحث». */
const noStudents = computed(() => !(statsRows.value ?? []).length)
const columns = computed(() => {
  const base = [
    { key: 'num', label: '#' },
    { key: 'student', label: 'الطالب' },
    // المعلم له حلقة واحدة: عمودا الحلقة والمعلّم يكرّران نفسيهما عنده فيُحذفان (أقلّ عرضاً، بلا تمرير)
    ...(isTeacher.value ? [] : [{ key: 'halqa', label: 'الحلقة' }, { key: 'teacher', label: 'المعلّم', class: 'col-teacher' }]),
    { key: 'parts', label: 'المحفوظ', align: 'center' as const, class: 'col-parts' },
    { key: 'status', label: 'الحالة' }
  ]
  // عمود الإجراءات للجميع: «عرض الملف» متاح لكل من يرى الطالب، والتعديل والحذف مقيّدان داخله
  return [...base, { key: 'actions', label: 'إجراءات', align: 'end' as const }]
})
// الصور الشخصية: صورة الطالب على حسابه (profiles عبر students.user_id). لا مفتاح بين الجدولين
// لـPostgREST، فتُجلب مسارات حسابات الطلاب ذوات الصور وحدها (قليلة) في طلبٍ واحد بلا قائمة معرّفات.
const { data: studentPhotoPaths } = useLazyAsyncData<Record<string, string>>('students-photo-paths', async () => {
  const { data } = await supabase
    .from('profiles')
    .select('id, photo_path')
    .eq('role', 'student')
    .not('photo_path', 'is', null)
  return Object.fromEntries((data ?? []).flatMap(p => p.photo_path ? [[p.id, p.photo_path]] : []))
}, { server: false, default: () => ({}) })
function studentPhotoPath(s: StudentRow) {
  return displayPhotoPath({ gender: s.gender, photo_path: s.user_id ? studentPhotoPaths.value?.[s.user_id] : null })
}
const { prime: primePhotos, urlFor: photoUrlFor } = useProfilePhotoUrls()
watch([rows, studentPhotoPaths], ([list]) => void primePhotos(list.map(studentPhotoPath)), { immediate: true })
// ── إضافة/تعديل ──
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
// المنطقةُ قائمةٌ منسدلة (طلب المستخدم 2026-10-22)، والقيمةُ القديمة المكتوبة يدوياً تبقى خياراً
const residenceOptions = computed(() => choiceItems(RESIDENCE_AREAS, form.residence))
const TAJWEED_NONE = 'none'
// الجنس بلا قيمة افتراضية (يحدّد حلقات الإسناد — فلا يُنسى فتصير الطالبة «ذكراً»)، والالتحاق اليومَ افتراضاً:
// الحضور يُحسب على الطالب من تاريخ التحاقه، فلا يبقى فارغاً
const todayLocal = () => new Date().toLocaleDateString('en-CA')
const form = reactive({
  full_name: '', national_id: '', gender: '' as Gender | '', birth_date: '', family_count: '',
  halaqa_id: HALQA_NONE, quran_parts: '', tajweed_level: TAJWEED_NONE,
  residence: '', nearest_mosque: '',
  guardian_name: '', guardian_phone: '', phone: '', guardian_email: '', enrollment_date: '',
  status: 'active' as StudentStatus
})
// تغيير الجنس إلى الآخر يُسقط حلقةً من غير جنسه (القاعدة والخادم يرفضانها)
watch(() => form.gender, (g) => {
  const cur = (halqat.value ?? []).find(h => h.id === form.halaqa_id)
  if (cur && cur.gender !== g) form.halaqa_id = HALQA_NONE
})
const tajweedItems = [
  { label: '—', value: TAJWEED_NONE },
  { label: 'تأهيلية', value: 'تأهيلية' },
  { label: 'عليا', value: 'عليا' },
  { label: 'تأهيل سند', value: 'تأهيل سند' },
  { label: 'سند', value: 'سند' }
]
const genderItems = [{ label: 'ذكر', value: 'male' }, { label: 'أنثى', value: 'female' }]
const statusItems = [
  { label: 'نشط', value: 'active' },
  { label: 'منقطع', value: 'withdrawn' },
  { label: 'متخرّج', value: 'graduated' },
  { label: 'منقول', value: 'transferred' }
]
function openCreate() {
  editingId.value = null
  Object.assign(form, {
    full_name: '', national_id: '', gender: '', birth_date: '', family_count: '',
    halaqa_id: HALQA_NONE, quran_parts: '', tajweed_level: TAJWEED_NONE,
    residence: '', nearest_mosque: '',
    guardian_name: '', guardian_phone: '', phone: '', guardian_email: '', enrollment_date: todayLocal(),
    status: 'active'
  })
  modalOpen.value = true
}
function openEdit(s: StudentRow) {
  editingId.value = s.id
  Object.assign(form, {
    full_name: s.full_name,
    national_id: s.national_id ?? '',
    gender: s.gender ?? '',
    birth_date: s.birth_date ?? '',
    family_count: s.family_count != null ? String(s.family_count) : '',
    halaqa_id: s.halaqa_id ?? HALQA_NONE,
    quran_parts: s.quran_parts != null ? String(s.quran_parts) : '',
    tajweed_level: s.tajweed_level ?? TAJWEED_NONE,
    residence: s.residence ?? '',
    nearest_mosque: s.nearest_mosque ?? '',
    guardian_name: s.guardian_name ?? '',
    guardian_phone: s.guardian_phone ?? '',
    phone: s.phone ?? '',
    guardian_email: s.guardian_email ?? '',
    enrollment_date: s.enrollment_date ?? '',
    status: s.status
  })
  modalOpen.value = true
}
function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  if (!s.full_name.trim()) errors.push({ name: 'full_name', message: 'اسم الطالب مطلوب.' })
  if (!s.gender) errors.push({ name: 'gender', message: 'اختر الجنس.' })
  if (!s.enrollment_date) errors.push({ name: 'enrollment_date', message: 'تاريخ الالتحاق مطلوب — منه يُحسب الحضور.' })
  // الهوية إلزامية عند الإضافة (معرّف دخول الطالب)، وتُفحص صيغتها متى عدّلها المدير الإداري
  if ((!editingId.value || isAdmin.value) && !isValidIdentity(s.national_id)) errors.push({ name: 'national_id', message: IDENTITY_ERROR })
  if (s.quran_parts && (Number(s.quran_parts) < 0 || Number(s.quran_parts) > 30)) errors.push({ name: 'quran_parts', message: 'الأجزاء بين 0 و30.' })
  return errors
}
const { createStudent: createStudentAccount, deleteStudent, changeStudentNationalId } = useAccountAdmin()
// بعد الإضافة: الهوية والكلمة المؤقّتة (مرّةً واحدة، قابلتان للنسخ)
const credentials = ref<AccountCredentials | null>(null)

/** إضافة طالب (المدير الإداري): الخادم ينشئ الحساب وصفّ الطالب، ثم تُكمَل بقية البيانات بتحديث. */
async function createStudent(details: Database['public']['Tables']['students']['Update']) {
  credentials.value = null
  const nationalId = normalizeDigits(form.national_id.trim())
  const created = await createStudentAccount({
    full_name: form.full_name.trim(),
    gender: form.gender as Gender, // validate يشترطه
    national_id: nationalId,
    halaqa_id: form.halaqa_id === HALQA_NONE ? undefined : form.halaqa_id,
    birth_date: form.birth_date || undefined,
    guardian_phone: form.guardian_phone.trim() || undefined
  })
  // الحساب أُنشئ: تُعرض بياناته ولو فشل استكمال التفاصيل (لا تُفقد الكلمة المؤقّتة)
  credentials.value = studentCredentials(form.full_name.trim(), nationalId, created.temp_password, 'created')
  const { error } = await supabase.from('students').update(details).eq('id', created.id)
  if (error) throw error
}

/** تعديل طالب: الهوية (إن تغيّرت) عبر الخادم لأنها معرّف الدخول، والباقي تحديثٌ مباشر تحكمه RLS. */
async function updateStudent(id: string, details: Database['public']['Tables']['students']['Update']) {
  const original = rows.value.find(s => s.id === id)
  const nationalId = normalizeDigits(form.national_id.trim())
  if (isAdmin.value && nationalId && nationalId !== original?.national_id) {
    await changeStudentNationalId(id, nationalId)
  }
  // الجنس للمدير الإداري وحده، والحلقة لمن يملك الإسناد — لا تُرسل لغيرهما (حارس القاعدة يرفضها)
  const payload = {
    ...details,
    ...(isAdmin.value && form.gender ? { gender: form.gender } : {}),
    ...(canAssign.value ? { halaqa_id: form.halaqa_id === HALQA_NONE ? null : form.halaqa_id } : {})
  }
  const { error } = await supabase.from('students').update(payload).eq('id', id)
  if (error) throw error
}

async function save() {
  saving.value = true
  try {
    const details = {
      full_name: form.full_name.trim(),
      birth_date: form.birth_date || null,
      family_count: form.family_count ? Number(form.family_count) : null,
      quran_parts: form.quran_parts ? Number(form.quran_parts) : null,
      tajweed_level: form.tajweed_level === TAJWEED_NONE ? null : form.tajweed_level,
      residence: form.residence.trim() || null,
      nearest_mosque: form.nearest_mosque.trim() || null,
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      phone: form.phone.trim() || null,
      guardian_email: form.guardian_email.trim() || null,
      enrollment_date: form.enrollment_date || null,
      status: form.status
    }
    if (editingId.value) {
      await updateStudent(editingId.value, details)
      toast.add({ title: 'تم تحديث بيانات الطالب.', color: 'success', icon: 'i-lucide-circle-check' })
    } else {
      await createStudent(details)
    }
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
    // أُنشئ الحساب وفشل استكمال التفاصيل: تُغلق النافذة كي لا يُعاد الإنشاء بالهوية نفسها (409)
    if (credentials.value) {
      modalOpen.value = false
      await refresh()
    }
  } finally {
    saving.value = false
  }
}

// ── حذف ──
const deleteTarget = ref<StudentRow | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    // عبر الخادم: صفّ الطالب ثم ملف حسابه ثم حساب الدخول — فلا يبقى دخولٌ لطالبٍ محذوف
    await deleteStudent(deleteTarget.value.id)
    toast.add({ title: 'تم حذف الطالب.', color: 'neutral', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="students">
    <UiPageHeader
      title="الطلاب"
      subtitle="سجلّ الطلاب وبياناتهم وإسنادهم للحلقات — يدخل الطالب برقم هويته."
    >
      <template #actions>
        <UButton
          v-if="canCreate"
          label="إضافة طالب"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openCreate"
        />
      </template>
    </UiPageHeader>

    <div class="filters">
      <UiSearchField
        v-model="query"
        placeholder="ابحث بالاسم أو رقم الهوية"
        :shown="total"
        :total="(statsRows ?? []).length"
        class="search"
      />
      <UiSelect
        v-model="statusF"
        :items="statusFilterItems"
        size="xl"
        class="filter-sel"
        aria-label="الحالة"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
      <!-- لا منتقي لمن يرى حلقةً واحدة (المعلم) — طلب المستخدم 2026-10-20 -->
      <UiSelect
        v-if="(halqat ?? []).length > 1"
        v-model="halqaF"
        :items="halqaFilterItems"
        size="xl"
        class="filter-sel"
        aria-label="الحلقة"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
    </div>

    <ClientOnly>
      <!-- أرقامُ الطلاب في النطاق بحلقته المختارة (لا تتبع البحثَ ولا الحالةَ: تعرض الحالاتِ نفسَها) -->
      <!-- من يرى القسمين (الإداري ومشرف المشروع): مفصولةً بين البنين والبنات (2026-10-22) -->
      <DashboardGenderSplit
        v-if="!noStudents && seesBoth"
        :items="splitStats"
      />
      <UiStatStrip
        v-else-if="!noStudents"
        :items="stats"
        label="أرقام الطلاب"
      />
      <!-- الهيكلُ في التحميل الأوّل وحدَه؛ وبين الصفحات يبقى الجدولُ باهتاً حتى تصل التالية (بلا وميض) -->
      <UiSkeletonTable
        v-if="pending && !rows.length"
        :columns="columns"
      />
      <UiEmptyState
        v-else-if="noStudents"
        icon="i-lucide-graduation-cap"
        title="لا طلاب بعد"
        :description="canCreate ? 'أضِف أول طالب واربطه بحلقته ليظهر هنا.' : 'لا طلاب في نطاقك حاليّاً.'"
      />
      <UiEmptyState
        v-else-if="!rows.length"
        icon="i-lucide-search-x"
        title="لا نتائج لهذا البحث"
        description="جرّب جزءاً من الاسم أو رقمَ الهوية، أو اعرض كلَّ الحالات والحلقات."
      >
        <UButton
          label="مسح البحث والفلاتر"
          color="neutral"
          variant="outline"
          icon="i-lucide-x"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="clearStudentFilters"
        />
      </UiEmptyState>
      <UiDataTable
        v-else
        :columns="columns"
        :rows="rows"
        row-key="id"
        refined
        :row-to="(r: StudentRow) => `/students/${r.id}`"
        :class="{ 'is-loading': pending }"
      >
        <template #num="{ index }">
          <span class="seq-n">{{ seq(index) }}</span>
        </template>
        <!-- الاسمُ سطرٌ واحدٌ لا ينكسر (كان كلمةً في السطر على العرض المتوسّط)، والكاملُ في التلميح -->
        <template #student="{ row }">
          <div class="user-cell">
            <div class="av">
              <ProfileAvatar
                :name="row.full_name"
                :photo-url="photoUrlFor(studentPhotoPath(row))"
              />
            </div>
            <div class="u-text">
              <NuxtLink
                :to="`/students/${row.id}`"
                class="u-name"
                :title="row.full_name"
              >
                {{ row.full_name }}
              </NuxtLink>
              <div
                v-if="row.national_id"
                class="u-sub"
                dir="ltr"
              >
                {{ row.national_id }}
              </div>
            </div>
          </div>
        </template>
        <!-- على العرض المتوسّط يسقط عمودُ المعلّم ويصير سطراً تحت الحلقة -->
        <template #halqa="{ row }">
          <div class="h-cell">
            <span class="h-name">{{ row.halaqa?.name || '—' }}</span>
            <span
              v-if="row.halaqa?.teacher?.full_name"
              class="h-teacher"
            >{{ row.halaqa.teacher.full_name }}</span>
          </div>
        </template>
        <template #teacher="{ row }">
          <span class="muted">{{ row.halaqa?.teacher?.full_name || '—' }}</span>
        </template>
        <template #parts="{ row }">
          <span
            v-if="row.quran_parts != null"
            class="parts-n"
          ><b>{{ row.quran_parts }}</b> جزء</span>
          <span
            v-else
            class="dash"
          >—</span>
        </template>
        <template #status="{ row }">
          <UBadge
            :label="studentStatusLabel(row.status, row.gender)"
            :color="STUDENT_STATUS[row.status]?.color"
            variant="soft"
          />
        </template>
        <!-- الصفُّ كلُّه يفتح الملف (فلا زرَّ «عرض»)؛ التعديلُ والحذفُ أيقونتان هادئتان، والسهمُ يدلّ على الفتح -->
        <template #actions="{ row }">
          <div class="actions">
            <UTooltip
              v-if="canManage"
              text="تعديل"
            >
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                :ui="{ base: 'rounded-[10px]' }"
                aria-label="تعديل"
                @click="openEdit(row)"
              />
            </UTooltip>
            <UTooltip
              v-if="canDelete"
              text="حذف"
            >
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                class="act-danger"
                :ui="{ base: 'rounded-[10px]' }"
                aria-label="حذف"
                @click="deleteTarget = row"
              />
            </UTooltip>
            <UIcon
              name="i-lucide-chevron-left"
              class="size-5 row-go"
              aria-hidden="true"
            />
          </div>
        </template>
      </UiDataTable>
      <!-- الحاوية الضيّقة (الجوال): بطاقةٌ لكل طالب بكل بياناته بلا تمرير أفقيّ — الجدول يُخفى هناك -->
      <ul
        v-if="rows.length"
        class="scards"
        :class="{ 'is-loading': pending }"
      >
        <li
          v-for="(row, i) in rows"
          :key="row.id"
          class="scard"
        >
          <NuxtLink
            :to="`/students/${row.id}`"
            class="scard-head"
          >
            <span class="scard-seq">{{ seq(i) }}</span>
            <span class="av">
              <ProfileAvatar
                :name="row.full_name"
                :photo-url="photoUrlFor(studentPhotoPath(row))"
              />
            </span>
            <span class="scard-id">
              <span class="u-name">{{ row.full_name }}</span>
              <span
                v-if="row.national_id"
                class="u-sub"
                dir="ltr"
              >{{ row.national_id }}</span>
            </span>
            <UBadge
              :label="studentStatusLabel(row.status, row.gender)"
              :color="STUDENT_STATUS[row.status]?.color"
              variant="soft"
              class="scard-status"
            />
          </NuxtLink>
          <!-- سطرٌ لكلٍّ بأيقونته وتسميةٍ بعرضٍ ثابت واسمٍ أوضح — كبطاقة الحلقة (2026-10-22) -->
          <ul class="scard-meta">
            <li v-if="!isTeacher">
              <span class="sm-ico"><UIcon
                name="i-lucide-book-open"
                class="size-4"
              /></span>
              <span class="sm-label">الحلقة</span>
              <span
                class="sm-val"
                :class="{ empty: !row.halaqa }"
              >{{ row.halaqa?.name || 'بلا حلقة' }}</span>
            </li>
            <li>
              <span class="sm-ico"><UIcon
                name="i-lucide-book-marked"
                class="size-4"
              /></span>
              <span class="sm-label">المحفوظ</span>
              <span
                class="sm-val"
                :class="{ empty: !row.quran_parts }"
              >{{ juzCountText(row.quran_parts) }}</span>
            </li>
          </ul>
          <div class="scard-actions">
            <UButton
              label="الملف"
              color="neutral"
              variant="outline"
              size="md"
              icon="i-lucide-eye"
              :ui="{ base: 'rounded-[11px]' }"
              @click="navigateTo(`/students/${row.id}`)"
            />
            <UButton
              v-if="canManage"
              label="تعديل"
              color="neutral"
              variant="outline"
              size="md"
              icon="i-lucide-pencil"
              :ui="{ base: 'rounded-[11px]' }"
              @click="openEdit(row)"
            />
            <UButton
              v-if="canDelete"
              color="neutral"
              variant="ghost"
              size="md"
              icon="i-lucide-trash-2"
              aria-label="حذف"
              :ui="{ base: 'rounded-[11px]' }"
              @click="deleteTarget = row"
            />
          </div>
        </li>
      </ul>
      <UiPaginator
        v-if="rows.length"
        :page="page"
        :page-count="pageCount"
        :total="total"
        :page-size="PAGE_SIZE"
        @update:page="page = $event"
      />
    </ClientOnly>

    <!-- نافذة إضافة/تعديل -->
    <UModal
      v-model:open="modalOpen"
      :title="editingId ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'"
    >
      <template #body>
        <UForm
          :state="form"
          :validate="validate"
          class="form"
          @submit="save"
        >
          <UFormField
            label="اسم الطالب"
            name="full_name"
          >
            <UInput
              v-model="form.full_name"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="row">
            <UFormField
              label="الجنس"
              name="gender"
              class="f"
            >
              <UiSelect
                v-model="form.gender"
                :items="genderItems"
                :disabled="!!editingId && !isAdmin"
                placeholder="ذكر أم أنثى؟"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="الحلقة"
              name="halaqa_id"
              class="f"
            >
              <UiSelect
                v-model="form.halaqa_id"
                :items="halqaItems"
                :disabled="!canAssign"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="رقم الهوية"
              name="national_id"
              class="f"
              :required="!editingId"
              :hint="editingId ? undefined : 'معرّف دخول الطالب'"
            >
              <UInput
                v-model="form.national_id"
                :disabled="!!editingId && !isAdmin"
                inputmode="numeric"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="تاريخ الميلاد"
              name="birth_date"
              class="f"
            >
              <UInput
                v-model="form.birth_date"
                type="date"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="اسم وليّ الأمر"
              name="guardian_name"
              class="f"
            >
              <UInput
                v-model="form.guardian_name"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="هاتف وليّ الأمر"
              name="guardian_phone"
              class="f"
            >
              <UInput
                v-model="form.guardian_phone"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="الأجزاء المحفوظة"
              name="quran_parts"
              class="f"
            >
              <UInput
                v-model="form.quran_parts"
                type="number"
                min="0"
                max="30"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الحالة"
              name="status"
              class="f"
            >
              <UiSelect
                v-model="form.status"
                :items="statusItems"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="عدد الأفراد"
              name="family_count"
              class="f"
            >
              <UInput
                v-model="form.family_count"
                type="number"
                min="0"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الأحكام (التجويد)"
              name="tajweed_level"
              class="f"
            >
              <UiSelect
                v-model="form.tajweed_level"
                :items="tajweedItems"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="السكن (المنطقة/الحي)"
              name="residence"
              class="f"
            >
              <USelect
                v-model="form.residence"
                :items="residenceOptions"
                placeholder="اختر"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="أقرب مسجد"
              name="nearest_mosque"
              class="f"
            >
              <UInput
                v-model="form.nearest_mosque"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="جوال الطالب"
              name="phone"
              class="f"
            >
              <UInput
                v-model="form.phone"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="تاريخ الالتحاق"
              name="enrollment_date"
              class="f"
              required
            >
              <UInput
                v-model="form.enrollment_date"
                type="date"
                :min="PROJECT_START_DATE"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField
            label="بريد وليّ الأمر (اختياري)"
            name="guardian_email"
          >
            <UInput
              v-model="form.guardian_email"
              type="email"
              dir="ltr"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="form-actions">
            <UButton
              label="إلغاء"
              color="neutral"
              variant="ghost"
              size="lg"
              :ui="{ base: 'rounded-[13px]' }"
              @click="modalOpen = false"
            />
            <UButton
              type="submit"
              :label="editingId ? 'حفظ التغييرات' : 'إضافة الطالب'"
              color="primary"
              size="lg"
              :loading="saving"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
            />
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- تأكيد الحذف -->
    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف الطالب"
      :loading="deleting"
      @update:open="v => { if (!v) deleteTarget = null }"
      @confirm="confirmDelete"
    >
      هل أنت متأكّد من حذف الطالب «<strong>{{ deleteTarget?.full_name }}</strong>»؟ يُحذف سجلّه ونتائجه وحساب دخوله، ولا يمكن التراجع.
    </UiConfirmModal>

    <!-- الهوية والكلمة المؤقّتة بعد الإضافة -->
    <AccountCredentialsModal
      :credentials="credentials"
      @close="credentials = null"
    />
  </div>
</template>

<style scoped>
/* صفحةٌ تُجلب: الحاليةُ باهتةٌ لا تُضغط حتى تصل التالية */
.is-loading { opacity: .5; pointer-events: none; transition: opacity .15s; }
/* الحاوية دون 720: بطاقات بدل الجدول (الجوال) — بلا تمرير أفقيّ */
.students { container: students / inline-size; }
.scards { display: none; list-style: none; margin: 0; padding: 0; }
@container students (max-width: 719px) {
  .students :deep(.table-wrap) { display: none; }
  .scards { display: grid; gap: 12px; }
}
.scard { background: var(--surface); border-radius: 16px; padding: 14px 16px; }
.scard-head { display: flex; align-items: center; gap: 12px; color: inherit; }
.scard-id { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.scard .u-sub { display: block; } /* الهوية تظهر في البطاقة (يُخفيها الجدول تحت 640) */
.scard-status { flex: none; }
.scard-seq { min-width: 26px; height: 26px; padding: 0 6px; flex: none; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.scard-meta { list-style: none; margin: 12px 0 0; padding: 8px 0 0; border-top: 1px solid var(--line); }
.scard-meta li { display: flex; align-items: center; gap: 10px; min-height: 40px; }
.scard-meta li + li { border-top: 1px dashed var(--line); }
.sm-ico { width: 28px; height: 28px; flex: none; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--ink-2); }
.sm-label { width: 64px; flex: none; font-size: 12.5px; color: var(--ink-3); }
.sm-val { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
.sm-val.empty { font-weight: 500; color: var(--ink-3); }
.scard-actions { display: flex; gap: 8px; margin-top: 14px; }
.scard-actions > :not([aria-label]) { flex: 1; justify-content: center; }
.filters { display: flex; align-items: center; gap: 12px 14px; flex-wrap: wrap; margin-bottom: 20px; container: filters / inline-size; }
.search { width: 300px; max-width: 100%; }
.filter-sel { width: 180px; }
/* متى ضاق الشريطُ عن الثلاثة في سطر (300+180+180+فراغان): البحثُ سطرٌ كامل والقائمتان تتقاسمان الثاني.
   بعرض الشريط لا الشاشة — في عرضٍ متوسّط مع القائمة الجانبية كانت الحلقاتُ تنزل وحدها، وفي الجوال تنضغط القائمتان */
@container filters (max-width: 699px) {
  .search { width: 100%; }
  .filter-sel { flex: 1 1 0; width: auto; min-width: 0; }
}
.muted { color: var(--ink-2); white-space: nowrap; }
/* خانةُ الطالب: لها عرضٌ أدنى فلا يُعصَر الاسمُ لأعمدةٍ أخرى، والاسمُ سطرٌ واحدٌ بـ«…» (2026-10-25) */
.user-cell { display: flex; align-items: center; gap: 11px; min-width: 230px; }
.av { width: 36px; height: 36px; border-radius: 10px; background: var(--green-ink); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; flex: none; overflow: hidden; }
.u-text { min-width: 0; }
.u-name { font-weight: 600; color: var(--ink); }
.u-text .u-name { display: block; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none; }
.u-text .u-name:hover { color: var(--blue-ink); }
.u-sub { font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 2px; }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.h-cell { display: flex; flex-direction: column; line-height: 1.4; }
.h-name { color: var(--ink); }
.h-teacher { display: none; font-size: 12.5px; color: var(--ink-3); white-space: nowrap; }
.parts-n { color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.parts-n b { color: var(--ink); font-weight: 600; }
.dash { color: var(--ink-3); opacity: .55; }
.row-go { color: var(--ink-3); margin-inline-start: 6px; transition: transform .15s, color .15s; }
.students :deep(tbody tr:hover) .row-go { color: var(--ink-2); transform: translateX(-3px); }
.actions :deep(.act-danger:hover) { color: var(--err); }
/* العرضُ المتوسّط: يسقط عمودُ المعلّم، ويظهر سطراً تحت الحلقة */
@container dt (max-width: 1099px) {
  .students :deep(.col-teacher) { display: none; }
  .h-teacher { display: block; }
}
/* والأضيقُ يُسقط «المحفوظ» (في ملفّ الطالب) فيبقى عمودُ الإجراءات ظاهراً بلا تمرير */
@container dt (max-width: 899px) {
  .students :deep(.col-parts) { display: none; }
}

.form { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row .f { flex: 1; min-width: 150px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

@media (max-width: 640px) { .u-sub { display: none; } }
</style>
