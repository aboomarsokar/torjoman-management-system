<script setup lang="ts">
/**
 * الحلقات (§4.13) — الإدارة للمديرَين الإداري والفني (والحذف للإداري)، والبقية للاطّلاع ضمن نطاقهم.
 * إنشاء/تعديل/حذف حلقة وتعيين معلّم ومشرف ومختبِر لها، مع تصفية بالجنس والحالة.
 * الجنس أوّل حقل، والطاقم (معلم/مشرف/مختبِر) من جنس الحلقة وحدَه (useHalaqaStaffOptions)،
 * والمختبِر يُقترح تلقائياً حين يوجد مختبِرٌ نشطٌ واحدٌ من جنسها. الحكم الأخير لحارس القاعدة.
 */
import type { Database } from '~/types/database.types'
import { SHOW_HALAQA_CLASSIFICATION } from '~/constants/halqat'
import { halaqaDeleteErrorMessage } from '~/utils/exams/nomination'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الحلقات — ترجمان' })

type Gender = Database['public']['Enums']['gender_type']
type Classification = Database['public']['Enums']['halaqa_classification']
type Status = Database['public']['Enums']['halaqa_status']
type HalaqaRow = Database['public']['Tables']['halaqat']['Row'] & {
  teacher: { full_name: string } | null
  supervisor: { full_name: string } | null
  examiner: { full_name: string } | null
  student_count: { count: number }[]
}

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
/** الإنشاءُ والتعديلُ والحذفُ للمدير الإداري وحده — كما يسمح RLS (والفنيُّ يطّلع — قرار 2026-10-22). */
const { isAdmin, isReadOnly, isFieldSupervisor, isWomenAdmin, isExaminer, isTechnical } = usePermissions()
// المشرفُ والمختبِرُ يريان حلقاتِهما المسندة وحدها وهي من جنسهما، والمديرةُ حلقاتِ البنات وحدها (RLS) —
// فلا معنى لقائمة «البنين والبنات» عندهم (طلب المستخدم 2026-10-21)
// والمديرُ الفنيّ لقسم البنين وحده (قرار 2026-10-22)
const seesBoth = computed(() => isAdmin.value || isReadOnly.value)
const showGenderFilter = computed(() => !isFieldSupervisor.value && !isWomenAdmin.value && !isExaminer.value && !isTechnical.value)

// جلب غير حاجز (useLazyAsyncData): لا يوقف عرض الصفحة — تظهر فوراً
// بحالة pending، والسكيلتون يغطّي الانتظار ريثما تصل البيانات. الاستعلامات
// الثلاثة مستقلّة، تعمل بالتوازي تلقائياً (لا حاجة لـ Promise.all هنا).
const { data: halqat, refresh, pending } = useLazyAsyncData<HalaqaRow[]>(
  'halqat-list',
  async () => {
    const { data, error } = await supabase
      .from('halaqat')
      .select('*, teacher:teacher_id(full_name), supervisor:supervisor_id(full_name), examiner:examiner_id(full_name), student_count:students(count)')
      // العدد للطلاب النشطين وحدهم (المنقطع يبقى مربوطاً بحلقته لكنه ليس من طلابها الحاليين)
      .eq('students.status', 'active')
      .order('created_at', { ascending: false })
      .returns<HalaqaRow[]>()
    if (error) {
      console.error('[halqat] فشل الجلب:', error.message)
      return []
    }
    return data ?? []
  },
  { server: false, default: () => [] }
)
const NO_SUP = NO_STAFF

const genderF = ref<Gender | 'all'>('all')
// «عرض الكل» من صفحة المشرف يفتح حلقاتِه وحدها (?supervisor=) — وتُزال بزرّها (طلب المستخدم 2026-10-22)
const route = useRoute()
const supervisorF = ref(typeof route.query.supervisor === 'string' ? route.query.supervisor : '')
const supervisorFName = computed(() => (halqat.value ?? []).find(h => h.supervisor_id === supervisorF.value)?.supervisor?.full_name ?? '')
function clearSupervisorF() {
  supervisorF.value = ''
  navigateTo({ query: { ...route.query, supervisor: undefined } }, { replace: true })
}
const statusF = ref<Status | 'all'>('all')
// قائمتان منسدلتان كصفحة الطلاب (طلب المستخدم 2026-10-20) — العددُ بجانب كلّ خيار
const genderFilterItems = computed(() => {
  const all = halqat.value ?? []
  const n = (g: Gender) => all.filter(h => h.gender === g).length
  return [
    { value: 'all' as const, label: `البنين والبنات (${all.length})` },
    { value: 'male' as const, label: `بنين (${n('male')})` },
    { value: 'female' as const, label: `بنات (${n('female')})` }
  ]
})
// تبويبان: الحلقات، والمعلّمون والمعلّمات (طلب المستخدم 2026-10-25) — والتبويبُ في الرابط (?tab=teachers)
type HalqatTab = 'halqat' | 'teachers'
const tab = ref<HalqatTab>(route.query.tab === 'teachers' ? 'teachers' : 'halqat')
watch(tab, t => navigateTo({ query: { ...route.query, tab: t === 'teachers' ? 'teachers' : undefined } }, { replace: true }))
const tabs = computed(() => [
  { key: 'halqat' as const, label: 'الحلقات', icon: 'i-lucide-book-open', count: (halqat.value ?? []).length },
  { key: 'teachers' as const, label: isWomenAdmin.value ? 'المعلّمات' : isTechnical.value ? 'المعلّمون' : 'المعلّمون والمعلّمات', icon: 'i-lucide-users' }
])
/** حلقاتُ النطاق لتبويب المعلّمين بأقلّ ما يلزمه. */
const teacherHalqat = computed(() => (halqat.value ?? []).map(h => ({
  id: h.id, name: h.name, gender: h.gender, status: h.status, teacher_id: h.teacher_id, students: studentsOf(h)
})))

// فلترُ المعلّم وبحثٌ باسم الحلقة أو المعلّم (طلب المستخدم 2026-10-25)
const teacherF = ref('all')
const queryH = ref('')
const teacherFilterItems = computed(() => {
  const m = new Map<string, { label: string, n: number }>()
  for (const h of halqat.value ?? []) {
    if (genderF.value !== 'all' && h.gender !== genderF.value) continue
    const cur = m.get(h.teacher_id)
    m.set(h.teacher_id, { label: h.teacher?.full_name ?? '—', n: (cur?.n ?? 0) + 1 })
  }
  const all = isWomenAdmin.value ? 'كل المعلّمات' : 'كل المعلّمين'
  return [{ value: 'all', label: all }, ...[...m].map(([value, t]) => ({ value, label: t.n > 1 ? `${t.label} (${t.n})` : t.label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'))]
})
const filtered = computed(() => (halqat.value ?? []).filter(h =>
  (genderF.value === 'all' || h.gender === genderF.value)
  && (statusF.value === 'all' || h.status === statusF.value)
  && (!supervisorF.value || h.supervisor_id === supervisorF.value)
  && (teacherF.value === 'all' || h.teacher_id === teacherF.value)
  && matchesSearch(queryH.value, h.name, h.teacher?.full_name)
))
const { page, pageCount, total, pageSize, paged, resetPage } = usePagination(filtered, 12)
watch([genderF, statusF, supervisorF, teacherF, queryH], resetPage)
function clearHalqatFilters() {
  queryH.value = ''
  teacherF.value = 'all'
  statusF.value = 'all'
  genderF.value = 'all'
}
// معلّمٌ من الجنس الآخر لا يبقى مختاراً بعد تغيير الجنس
watch(genderF, () => {
  if (!teacherFilterItems.value.some(i => i.value === teacherF.value)) teacherF.value = 'all'
})
function studentsOf(h: HalaqaRow) {
  return h.student_count?.[0]?.count ?? 0
}

// الجنس والفئة والوقت في خانة الحلقة نفسها. الطاقم ثلاثة أعمدة في الحاوية الواسعة،
// وعمودٌ واحد مكدَّس فيما دونها (col-wide / col-narrow — الاستعلام في أنماط الصفحة)
// عمود الإجراءات للجميع: «تفاصيل» لكل من يرى الحلقة (ومنهم مشرف المشروع)، والتعديل والحذف مقيّدان داخله
const allColumns = [
  { key: 'num', label: '#' },
  { key: 'name', label: 'الحلقة' },
  { key: 'teacher', label: 'المعلّم', class: 'col-wide' },
  { key: 'supervisorName', label: 'المشرف', class: 'col-wide' },
  { key: 'examiner', label: 'المختبِر', class: 'col-wide' },
  { key: 'staff', label: 'الطاقم', class: 'col-narrow' },
  { key: 'students', label: 'الطلاب', align: 'center' as const },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'إجراءات', align: 'end' as const }
]
// المشرف الميدانيّ يرى حلقاتِه المسندة إليه وحدها، فعمودُ «المشرف» تكرارٌ لاسمه
const columns = computed(() => isFieldSupervisor.value ? allColumns.filter(c => c.key !== 'supervisorName') : allColumns)
// ── إنشاء/تعديل ──
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '', teacher_id: '', supervisor_id: NO_SUP, examiner_id: NO_SUP, daily_time: '',
  gender: '' as Gender | '', classification: 'a' as Classification, status: 'active' as Status
})
const genderItems = [{ label: 'بنين', value: 'male' }, { label: 'بنات', value: 'female' }]

// الطاقم من جنس الحلقة وحدَه، ولا قائمة قبل اختياره (والمختبِر يُقترح حين يكون واحداً)
const { teacherItems, supervisorItems, examinerItems } = useHalaqaStaffOptions(form, halqat, editingId)
// القائمة الفارغة تقول سببها (كانت لا تُفتح بلا كلمة فيظنّ المدير النموذج معطّلاً)
const teacherPlaceholder = computed(() => {
  if (!form.gender) return 'اختر الجنس أولاً'
  if (!teacherItems.value.length) return form.gender === 'female' ? 'لا معلّمات متاحات — كلّهنّ على حلقات نشطة' : 'لا معلّمون متاحون — كلّهم على حلقات نشطة'
  return 'اختر من القائمة'
})
const classItems = [{ label: 'الفئة أ', value: 'a' }, { label: 'الفئة ب', value: 'b' }]
const statusItems = [{ label: 'نشطة', value: 'active' }, { label: 'متوقفة', value: 'stopped' }]
function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', teacher_id: '', supervisor_id: NO_SUP, examiner_id: NO_SUP, daily_time: '', gender: '', classification: 'a', status: 'active' })
  modalOpen.value = true
}
function openEdit(h: HalaqaRow) {
  editingId.value = h.id
  Object.assign(form, {
    name: h.name,
    teacher_id: h.teacher_id,
    supervisor_id: h.supervisor_id ?? NO_SUP,
    examiner_id: h.examiner_id ?? NO_SUP,
    daily_time: h.daily_time ? h.daily_time.slice(0, 5) : '',
    gender: h.gender ?? '',
    classification: h.classification ?? 'a',
    status: h.status
  })
  modalOpen.value = true
}
function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  if (!s.gender) errors.push({ name: 'gender', message: 'اختر جنس الحلقة أولاً.' })
  if (!s.name.trim()) errors.push({ name: 'name', message: 'اسم الحلقة مطلوب.' })
  if (!s.teacher_id) errors.push({ name: 'teacher_id', message: 'تعيين المعلّم مطلوب.' })
  return errors
}
async function save() {
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      teacher_id: form.teacher_id,
      supervisor_id: form.supervisor_id === NO_SUP ? null : form.supervisor_id,
      examiner_id: form.examiner_id === NO_SUP ? null : form.examiner_id,
      daily_time: form.daily_time || null,
      gender: form.gender as Gender, // validate يشترطه قبل الحفظ
      classification: form.classification,
      status: form.status
    }
    const { error } = editingId.value
      ? await supabase.from('halaqat').update(payload).eq('id', editingId.value)
      : await supabase.from('halaqat').insert(payload)
    if (error) throw error
    toast.add({ title: editingId.value ? 'تم تحديث الحلقة.' : 'تم إنشاء الحلقة.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

// ── حذف ──
const deleteTarget = ref<HalaqaRow | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('halaqat').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    toast.add({ title: 'تم حذف الحلقة.', color: 'neutral', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    // حارسُ تاريخ الاختبارات: حلقةٌ لها ترشيحاتٌ مرصودة لا تُحذف بل تُعطَّل
    const graded = halaqaDeleteErrorMessage(err)
    handle(graded ? new Error(graded) : err, 'تعذّر الحذف — قد تكون الحلقة مرتبطة بطلاب.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="halqat">
    <UiSegmentTabs
      v-model="tab"
      :tabs="tabs"
      label="الحلقات والمعلّمون"
    />
    <!-- العنوان في الشريط العلوي؛ هنا صفّ أدواتٍ واحد: التصفية ثم الإنشاء — والجنسُ للتبويبين معاً -->
    <div class="toolbar">
      <div class="filters">
        <UiSearchField
          v-if="tab === 'halqat'"
          v-model="queryH"
          placeholder="ابحث باسم الحلقة أو المعلّم"
          :shown="filtered.length"
          :total="(halqat ?? []).length"
          class="search"
        />
        <UiSelect
          v-if="showGenderFilter"
          v-model="genderF"
          :items="genderFilterItems"
          size="xl"
          class="filter-sel"
          aria-label="الجنس"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
        <UiSelect
          v-if="tab === 'halqat'"
          v-model="teacherF"
          :items="teacherFilterItems"
          size="xl"
          class="filter-sel teacher-sel"
          :aria-label="isWomenAdmin ? 'المعلّمة' : 'المعلّم'"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
        <UiSelect
          v-if="tab === 'halqat'"
          v-model="statusF"
          :items="[{ label: 'كل الحالات', value: 'all' }, ...statusItems]"
          size="xl"
          class="filter-sel"
          aria-label="الحالة"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
        <UButton
          v-if="supervisorF"
          :label="`المشرف: ${supervisorFName || '…'}`"
          color="neutral"
          variant="soft"
          trailing-icon="i-lucide-x"
          aria-label="إزالة تصفية المشرف"
          :ui="{ base: 'rounded-[12px] min-h-12 font-semibold' }"
          @click="clearSupervisorF"
        />
      </div>
      <UButton
        v-if="isAdmin && tab === 'halqat'"
        label="إنشاء حلقة"
        color="primary"
        size="md"
        icon="i-lucide-plus"
        class="create"
        :ui="{ base: 'rounded-[12px] font-semibold min-h-12' }"
        @click="openCreate"
      />
    </div>

    <ClientOnly>
      <HalqatTeachersTab
        v-if="tab === 'teachers'"
        :halqat="teacherHalqat"
        :gender="genderF"
        :all-teachers="seesBoth || isWomenAdmin || isTechnical"
        :female-only="isWomenAdmin"
      />
      <div
        v-else
        id="panel-halqat"
        role="tabpanel"
        aria-labelledby="tab-halqat"
      >
        <!-- من يرى القسمين ولم يُصفِّ بالجنس: مفصولةً بين البنين والبنات (2026-10-22)؛ وإلا خلاصةُ القسم -->
        <DashboardGenderSplit
          v-if="!pending && filtered.length && seesBoth && genderF === 'all'"
          :items="halqatSplitStats(filtered)"
        />
        <HalqatSummary
          v-else-if="!pending && filtered.length"
          :rows="filtered"
        />
        <UiSkeletonTable
          v-if="pending"
          :columns="columns"
        />
        <UiEmptyState
          v-else-if="!(halqat ?? []).length"
          icon="i-lucide-book-open"
          title="لا حلقات بعد"
          :description="isAdmin ? 'أنشئ أول حلقة وعيّن لها معلّماً لتظهر هنا.' : 'لا حلقات ضمن نطاقك بعد.'"
        />
        <!-- فراغُ التصفية غيرُ فراغ النطاق: المخرجُ مسحُ الفلاتر -->
        <UiEmptyState
          v-else-if="filtered.length === 0"
          icon="i-lucide-filter-x"
          title="لا حلقاتٍ لهذا الاختيار"
          description="جرّب اسماً آخر أو معلّماً آخر، أو اعرض الحلقات كلَّها."
        >
          <UButton
            label="مسح الفلاتر"
            color="neutral"
            variant="outline"
            icon="i-lucide-x"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="clearHalqatFilters"
          />
        </UiEmptyState>
        <UiDataTable
          v-else
          :columns="columns"
          :rows="paged"
          row-key="id"
        >
          <template #num="{ index }">
            <span class="num idx">{{ (page - 1) * pageSize + index + 1 }}</span>
          </template>
          <template #name="{ row }">
            <HalqatNameCell
              :id="row.id"
              :name="row.name"
              :gender="row.gender"
              :classification="row.classification"
              :daily-time="row.daily_time"
            />
          </template>
          <template #teacher="{ row }">
            <span class="person">{{ row.teacher?.full_name || '—' }}</span>
          </template>
          <template #supervisorName="{ row }">
            <span
              class="person"
              :class="{ orphan: !row.supervisor }"
            >{{ row.supervisor?.full_name || 'بلا مشرف' }}</span>
          </template>
          <template #examiner="{ row }">
            <span
              class="person"
              :class="{ orphan: !row.examiner }"
            >{{ row.examiner?.full_name || 'بلا مختبِر' }}</span>
          </template>
          <template #staff="{ row }">
            <HalqatStaffList
              :teacher="row.teacher?.full_name ?? null"
              :supervisor="row.supervisor?.full_name ?? null"
              :hide-supervisor="isFieldSupervisor"
              :examiner="row.examiner?.full_name ?? null"
              :gender="row.gender"
              card
              dense
            />
          </template>
          <!-- العددُ شارةٌ بتمييزه وجنس الحلقة («6 طالبات») كبطاقة الجوال (2026-10-22) -->
          <template #students="{ row }">
            <span
              class="stud"
              :class="{ zero: !studentsOf(row) }"
            ><UIcon
              name="i-lucide-users"
              class="size-3.5"
            />{{ studentsCountText(studentsOf(row), row.gender === 'female') }}</span>
          </template>
          <template #status="{ row }">
            <UBadge
              :label="row.status === 'active' ? 'نشطة' : 'متوقفة'"
              :color="row.status === 'active' ? 'success' : 'neutral'"
              variant="soft"
              size="sm"
            />
          </template>
          <template #actions="{ row }">
            <div class="actions">
              <UButton
                :to="`/halqat/${row.id}`"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-eye"
                :ui="{ base: 'rounded-[10px]' }"
                aria-label="تفاصيل"
              />
              <UButton
                v-if="isAdmin"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-pencil"
                :ui="{ base: 'rounded-[10px]' }"
                aria-label="تعديل"
                @click="openEdit(row)"
              />
              <UButton
                v-if="isAdmin"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-trash-2"
                :ui="{ base: 'rounded-[10px]' }"
                aria-label="حذف"
                @click="deleteTarget = row"
              />
            </div>
          </template>
        </UiDataTable>
        <!-- الحاوية الضيّقة (الجوال): بطاقاتٌ بدل الجدول — الجدول يُخفى هناك بالاستعلام -->
        <ul
          v-if="!pending && filtered.length"
          class="cards"
        >
          <li
            v-for="row in paged"
            :key="row.id"
            class="hcard"
          >
            <div class="hcard-top">
              <HalqatNameCell
                :id="row.id"
                :name="row.name"
                :gender="row.gender"
                :classification="row.classification"
                :daily-time="row.daily_time"
              />
              <UBadge
                :label="row.status === 'active' ? 'نشطة' : 'متوقفة'"
                :color="row.status === 'active' ? 'success' : 'neutral'"
                variant="soft"
                size="sm"
              />
            </div>
            <HalqatStaffList
              :teacher="row.teacher?.full_name ?? null"
              :supervisor="row.supervisor?.full_name ?? null"
              :hide-supervisor="isFieldSupervisor"
              :examiner="row.examiner?.full_name ?? null"
              :gender="row.gender"
              :students="studentsOf(row)"
              card
            />
            <div
              v-if="isAdmin"
              class="hcard-actions"
            >
              <UButton
                label="تعديل"
                color="neutral"
                variant="outline"
                size="md"
                icon="i-lucide-pencil"
                :ui="{ base: 'rounded-[11px]' }"
                @click="openEdit(row)"
              />
              <UButton
                v-if="isAdmin"
                label="حذف"
                color="neutral"
                variant="ghost"
                size="md"
                icon="i-lucide-trash-2"
                :ui="{ base: 'rounded-[11px]' }"
                @click="deleteTarget = row"
              />
            </div>
          </li>
        </ul>
        <UiPaginator
          v-if="filtered.length"
          :page="page"
          :page-count="pageCount"
          :total="total"
          :page-size="pageSize"
          @update:page="page = $event"
        />
      </div>
    </ClientOnly>

    <!-- نافذة إنشاء/تعديل -->
    <UModal
      v-model:open="modalOpen"
      :title="editingId ? 'تعديل الحلقة' : 'إنشاء حلقة جديدة'"
    >
      <template #body>
        <UForm
          :state="form"
          :validate="validate"
          class="form"
          @submit="save"
        >
          <div class="row">
            <UFormField
              label="الجنس"
              name="gender"
              class="f"
            >
              <USelect
                v-model="form.gender"
                :items="genderItems"
                placeholder="بنين أم بنات؟"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="اسم الحلقة"
              name="name"
              class="f"
            >
              <UInput
                v-model="form.name"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              :label="form.gender === 'female' ? 'المعلّمة' : 'المعلّم'"
              name="teacher_id"
              class="f"
            >
              <UiSelect
                v-model="form.teacher_id"
                :items="teacherItems"
                :placeholder="teacherPlaceholder"
                :disabled="!form.gender"
                size="lg"
              />
            </UFormField>
            <UFormField
              :label="form.gender === 'female' ? 'المشرفة' : 'المشرف'"
              name="supervisor_id"
              class="f"
            >
              <UiSelect
                v-model="form.supervisor_id"
                :items="supervisorItems"
                :disabled="!form.gender"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              :label="form.gender === 'female' ? 'المختبِرة' : 'المختبِر'"
              name="examiner_id"
              class="f"
              hint="يرصد ترشيحاتها"
            >
              <UiSelect
                v-model="form.examiner_id"
                :items="examinerItems"
                :disabled="!form.gender"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="الوقت اليومي"
              name="daily_time"
              class="f"
            >
              <UInput
                v-model="form.daily_time"
                type="time"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <!-- التصنيفُ ملغًى حاليّاً (constants/halqat.ts): الإنشاءُ يحفظ «أ» افتراضاً والتعديلُ يُبقي القائم -->
            <UFormField
              v-if="SHOW_HALAQA_CLASSIFICATION"
              label="التصنيف"
              name="classification"
              class="f"
            >
              <USelect
                v-model="form.classification"
                :items="classItems"
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
              <USelect
                v-model="form.status"
                :items="statusItems"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
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
              :label="editingId ? 'حفظ التغييرات' : 'إنشاء الحلقة'"
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
      title="حذف الحلقة"
      :loading="deleting"
      @update:open="v => { if (!v) deleteTarget = null }"
      @confirm="confirmDelete"
    >
      هل أنت متأكّد من حذف حلقة «<strong>{{ deleteTarget?.name }}</strong>»؟ لا يمكن التراجع.
    </UiConfirmModal>
  </div>
</template>

<style scoped>
/* الصفحة تملأ مساحة المحتوى (لا عرض أقصى)، وتتكيّف بعرض حاويتها لا بعرض النافذة:
   ≥1180 أعمدة الطاقم الثلاثة · دونها عمود «الطاقم» المكدَّس · دون 720 بطاقات */
.halqat { container: halqat / inline-size; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; flex-wrap: wrap; margin-bottom: 16px; }
.filters { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; }
.filter-sel { width: 190px; }
.teacher-sel { width: 230px; }
.search { width: 300px; }

.num { font-variant-numeric: tabular-nums; }
.idx { color: var(--ink-3); font-size: 13px; }
.person { color: var(--ink-2); }
.person.orphan { color: var(--ink-3); }
.stud { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.stud.zero { background: var(--surface-2); color: var(--ink-3); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

.halqat :deep(.col-narrow) { display: none; }
@container halqat (max-width: 1179px) {
  .halqat :deep(.col-wide) { display: none; }
  .halqat :deep(.col-narrow) { display: table-cell; }
}

.cards { display: none; list-style: none; margin: 0; padding: 0; }
@container halqat (max-width: 719px) {
  .halqat :deep(.table-wrap) { display: none; }
  .cards { display: grid; gap: 12px; }
  .toolbar { align-items: stretch; }
  /* البحثُ سطرٌ كامل، والقوائمُ تتقاسم ما تحته (كانت قائمتين في سطرٍ لا يلتفّ) */
  .filters { width: 100%; flex-wrap: wrap; }
  .search { flex: 1 1 100%; width: auto; }
  .filter-sel, .teacher-sel { flex: 1 1 140px; width: auto; min-width: 0; }
  .create { width: 100%; justify-content: center; min-height: 48px; }
}
.hcard { background: var(--surface); border-radius: 16px; padding: 16px; }
.hcard-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--line); }
.hcard-actions { display: flex; gap: 8px; margin-top: 16px; }
.hcard-actions > :first-child { flex: 1; justify-content: center; }

.form { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row .f { flex: 1; min-width: 150px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
</style>
