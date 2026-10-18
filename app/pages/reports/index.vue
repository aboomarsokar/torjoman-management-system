<script setup lang="ts">
/**
 * التقرير الشهري للحلقة (§4.17).
 * المعلّم يرفع تقرير حلقته (حفظ/مراجعة/غياب/نقاط/درجة لكل طالب + أنشطة مصاحبة)،
 * ونطاق الاعتماد (الإداري والفني والمديرة الإدارية للبنات) يعتمده. صفحات الحفظ/المراجعة محسوبة في القاعدة.
 * RLS: المعلّم مسودّةً ← مُرسَل فقط، والاعتماد لنطاقه.
 * يُختار الشهر/السنة (لا مستقبل)، وتقرير واحد لكل (حلقة، شهر، سنة).
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'التقارير الشهرية — ترجمان' })

type ReportStatus = Database['public']['Enums']['report_status']
type ActivityKey = Database['public']['Enums']['activity_key']

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const { exportXlsx } = useExport()
const toast = useToast()
/** الاعتماد وإعادة الفتح لنطاق الاعتماد (الإداري والفني، والمديرة الإدارية لحلقات البنات — RLS يقصره). */
const { isTeacher, canApprove, isManager, isReadOnly } = usePermissions()

// ── المفاتيح والتسميات ──
const ACTIVITY_GROUPS: { title: string, keys: { key: ActivityKey, label: string }[] }[] = [
  { title: 'اللقاءات التدبّرية', keys: [1, 2, 3, 4].map(n => ({ key: `reflection_${n}` as ActivityKey, label: `تدبّر ${n}` })) },
  { title: 'المراجعة الأسبوعية', keys: [1, 2, 3, 4].map(n => ({ key: `weekly_review_${n}` as ActivityKey, label: `مراجعة ${n}` })) },
  { title: 'المقرر التربوي', keys: [1, 2, 3, 4].map(n => ({ key: `edu_curriculum_${n}` as ActivityKey, label: `مقرر ${n}` })) },
  { title: 'أخرى', keys: [{ key: 'video_lecture' as ActivityKey, label: 'محاضرة مرئية' }, { key: 'values_followup' as ActivityKey, label: 'متابعة القيم' }] }
]
const ALL_KEYS = ACTIVITY_GROUPS.flatMap(g => g.keys.map(k => k.key))

// ── المُحدِّدات ──
const now = new Date()
const halqaId = ref('')
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

type NameRow = { id: string, name: string }

// حلقة المعلّم تلقائيّاً (لا يختارها) — جلب غير حاجز (useLazyAsyncData): الاستعلامان
// (هنا وأسفل reports-list) مستقلّان ويعملان بالتوازي تلقائياً
const { data: myHalqa } = useLazyAsyncData<NameRow | null>('reports-my-halqa', async () => {
  if (role.value !== 'teacher') return null
  const { data } = await supabase.from('halaqat').select('id, name').eq('teacher_id', profile.value?.id ?? '').limit(1).maybeSingle()
  return data
}, { server: false, default: () => null, watch: [role] })
const curMonth = now.getMonth() + 1
const curYear = now.getFullYear()
// لا تُتاح الأشهر التي لم تبدأ بعد (المُحفِّز يرفضها) — تُقصَر للسنة الحالية على ≤ الشهر الحالي
const monthItems = computed(() => MONTH_NAMES
  .map((m, i) => ({ label: m, value: i + 1 }))
  .filter(it => year.value < curYear || it.value <= curMonth))
const yearItems = [curYear - 1, curYear].map(y => ({ label: String(y), value: y }))
// عند تغيير السنة للحالية وكان الشهر مستقبليّاً، أرجِعه للشهر الحالي
watch(year, () => {
  if (year.value === curYear && month.value > curMonth) month.value = curMonth
})

// ── حالة التقرير المحمّل ──
type Row = {
  student_id: string
  full_name: string
  memorization_from: number | string
  memorization_to: number | string
  review_to: number | string
  absence_excused: number | string
  absence_unexcused: number | string
  monthly_points: number | string
  student_grade: number | string
  notes: string
}
const loaded = ref(false)
const loading = ref(false)
const report = ref<{ id: string, status: ReportStatus } | null>(null)
const rows = ref<Row[]>([])
const acts = reactive<Record<string, boolean>>({})
const meta = reactive({ general_notes: '', activities_notes: '' })

// المعلّم وحده يحرّر التقرير (المدير يستقبل ويعتمد فقط)
// المعلّم يعدّل المسودّة فقط (أو تقريراً لم يُحفظ بعد) — حارس القاعدة يرفض أيّ تعديل بعد الإرسال
const canEdit = computed(() => isTeacher.value && (!report.value || report.value.status === 'draft'))
/** تقرير المعلّم بعد الإرسال: للقراءة فقط حتى يعتمده نطاق الاعتماد أو يعيد فتحه. */
const teacherLocked = computed(() => isTeacher.value && !!report.value && report.value.status !== 'draft')
const num = (v: number | string) => (v === '' || v === null || v === undefined) ? null : Number(v)
const pagesOf = (r: Row) => (num(r.memorization_to) ?? 0) - (num(r.memorization_from) ?? 0)
const reviewOf = (r: Row) => (num(r.review_to) ?? 0) - (num(r.memorization_from) ?? 0)

// ── الدرجات المحسوبة (§4.24) ──
const { settings: gradeCfg, loadSettings, computeStudentGrade, computeHalqaAchievement, gradeLabel, achievementColor } = useGrades()
onMounted(loadSettings)
const gradeOf = (r: Row) => computeStudentGrade({
  memoPages: pagesOf(r),
  reviewPages: reviewOf(r),
  absenceUnexcused: num(r.absence_unexcused) ?? 0,
  points: num(r.monthly_points) ?? 0
}, gradeCfg.value).total
const activitiesPct = computed(() => Math.round(ALL_KEYS.filter(k => acts[k]).length / ALL_KEYS.length * 100))
const halqaAchievement = computed(() => computeHalqaAchievement(rows.value.map(gradeOf), activitiesPct.value))

const exporting = ref(false)
async function doExport() {
  exporting.value = true
  try {
    const headers = ['الطالب', 'من', 'إلى', 'صفحات الحفظ', 'مراجعة لـ', 'صفحات المراجعة', 'غياب بعذر', 'بلا عذر', 'النقاط', 'الدرجة']
    const data = rows.value.map(r => [
      r.full_name, num(r.memorization_from) ?? '', num(r.memorization_to) ?? '', pagesOf(r),
      num(r.review_to) ?? '', reviewOf(r), num(r.absence_excused) ?? 0, num(r.absence_unexcused) ?? 0,
      num(r.monthly_points) ?? '', gradeOf(r)
    ])
    const label = `${MONTH_NAMES[month.value - 1]}-${year.value}`
    await exportXlsx(`تقرير-${label}`, headers, data, 'التقرير')
  } finally {
    exporting.value = false
  }
}

async function load() {
  if (!halqaId.value) return
  loading.value = true
  try {
    const { data: rep } = await supabase
      .from('monthly_reports')
      .select('id, status, general_notes, activities_notes')
      .eq('halaqa_id', halqaId.value).eq('report_month', month.value).eq('report_year', year.value)
      .maybeSingle()
    report.value = rep ? { id: rep.id, status: rep.status } : null
    meta.general_notes = rep?.general_notes ?? ''
    meta.activities_notes = rep?.activities_notes ?? ''

    let repRows: { student_id: string, memorization_from: number | null, memorization_to: number | null, review_to: number | null, absence_excused: number, absence_unexcused: number, monthly_points: number | null, student_grade: number | null, notes: string | null }[] = []
    const doneKeys = new Set<string>()
    if (rep) {
      const [{ data: rs }, { data: ra }] = await Promise.all([
        supabase.from('monthly_report_students').select('*').eq('report_id', rep.id),
        supabase.from('monthly_report_activities').select('activity_key, done').eq('report_id', rep.id)
      ])
      repRows = rs ?? []
      for (const a of ra ?? []) if (a.done) doneKeys.add(a.activity_key)
    }

    const { data: studs } = await supabase.from('students').select('id, full_name').eq('halaqa_id', halqaId.value).eq('status', 'active').order('full_name')
    rows.value = (studs ?? []).map((s) => {
      const ex = repRows.find(r => r.student_id === s.id)
      return {
        student_id: s.id,
        full_name: s.full_name,
        memorization_from: ex?.memorization_from ?? '',
        memorization_to: ex?.memorization_to ?? '',
        review_to: ex?.review_to ?? '',
        absence_excused: ex?.absence_excused ?? '',
        absence_unexcused: ex?.absence_unexcused ?? '',
        monthly_points: ex?.monthly_points ?? '',
        student_grade: ex?.student_grade ?? '',
        notes: ex?.notes ?? ''
      }
    })
    for (const k of ALL_KEYS) acts[k] = doneKeys.has(k)
    loaded.value = true
  } catch (err) {
    handle(err)
  } finally {
    loading.value = false
  }
}

// ── قائمة التقارير (استعراض سريع) ──
type ListRow = {
  id: string
  halaqa_id: string
  report_month: number
  report_year: number
  status: ReportStatus
  halaqa: { name: string, teacher: { full_name: string } | null } | null
  students: { memorization_pages: number | null, review_pages: number | null, absence_unexcused: number, monthly_points: number | null }[]
  activities: { done: boolean }[]
}
const { data: reportsList, refresh: refreshList, pending: listPending } = useLazyAsyncData<ListRow[]>('reports-list', async () => {
  const { data } = await supabase
    .from('monthly_reports')
    .select('id, halaqa_id, report_month, report_year, status, halaqa:halaqa_id(name, teacher:teacher_id(full_name)), students:monthly_report_students(memorization_pages, review_pages, absence_unexcused, monthly_points), activities:monthly_report_activities(done)')
    .order('report_year', { ascending: false })
    .order('report_month', { ascending: false })
    .returns<ListRow[]>()
  return data ?? []
}, { server: false, default: () => [] })
watchEffect(() => {
  if (isTeacher.value && myHalqa.value && !halqaId.value) halqaId.value = myHalqa.value.id
})

// إثراء كل تقرير بإنجاز الحلقة المحسوب (§4.17د)
function cardOf(r: ListRow) {
  const totals = (r.students ?? []).map(s => computeStudentGrade({
    memoPages: s.memorization_pages ?? 0,
    reviewPages: s.review_pages ?? 0,
    absenceUnexcused: s.absence_unexcused ?? 0,
    points: s.monthly_points ?? 0
  }, gradeCfg.value))
  const reg = totals.length ? Math.round(totals.reduce((a, b) => a + b.regularity, 0) / totals.length) : 0
  const actPct = Math.round((r.activities ?? []).filter(a => a.done).length / ALL_KEYS.length * 100)
  const achievement = computeHalqaAchievement(totals.map(t => t.total), actPct)
  return { reg, actPct, achievement, students: totals.length }
}

const listFilter = ref<ReportStatus | 'all'>('all')
const countByStatus = (st: ReportStatus) => (reportsList.value ?? []).filter(r => r.status === st).length
const submittedCount = computed(() => countByStatus('submitted'))
const listChips = computed(() => [
  { value: 'all' as const, label: 'الكل', count: (reportsList.value ?? []).length },
  { value: 'submitted' as const, label: 'بانتظار الاعتماد', count: countByStatus('submitted') },
  { value: 'approved' as const, label: 'معتمد', count: countByStatus('approved') },
  { value: 'draft' as const, label: 'مسودّة', count: countByStatus('draft') }
])
const listFiltered = computed(() => (reportsList.value ?? []).filter(r => listFilter.value === 'all' || r.status === listFilter.value))

async function openReport(r: ListRow) {
  halqaId.value = r.halaqa_id
  month.value = r.report_month
  year.value = r.report_year
  await load()
  await nextTick()
  document.querySelector('.statusbar')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const saving = ref(false)
async function save() {
  if (!halqaId.value) return
  if (year.value === curYear && month.value > curMonth) {
    toast.add({ title: 'لا يمكن إنشاء تقرير لشهر لم يبدأ بعد.', color: 'error', icon: 'i-lucide-calendar-x' })
    return
  }
  saving.value = true
  try {
    let rid = report.value?.id
    if (!rid) {
      const { data, error } = await supabase.from('monthly_reports')
        .insert({ halaqa_id: halqaId.value, report_month: month.value, report_year: year.value, status: 'draft', general_notes: meta.general_notes || null, activities_notes: meta.activities_notes || null })
        .select('id, status').single()
      if (error || !data) throw error
      report.value = { id: data.id, status: data.status }
      rid = data.id
    } else {
      const { error } = await supabase.from('monthly_reports').update({ general_notes: meta.general_notes || null, activities_notes: meta.activities_notes || null }).eq('id', rid)
      if (error) throw error
    }

    // الطلاب: استبدال كامل
    await supabase.from('monthly_report_students').delete().eq('report_id', rid)
    const rowPayload = rows.value
      .filter(r => [r.memorization_from, r.memorization_to, r.review_to, r.absence_excused, r.absence_unexcused, r.monthly_points, r.notes].some(v => v !== '' && v !== null))
      .map(r => ({
        report_id: rid!,
        student_id: r.student_id,
        memorization_from: num(r.memorization_from),
        memorization_to: num(r.memorization_to),
        review_to: num(r.review_to),
        absence_excused: num(r.absence_excused) ?? 0,
        absence_unexcused: num(r.absence_unexcused) ?? 0,
        monthly_points: num(r.monthly_points),
        student_grade: gradeOf(r), // محسوبة تلقائيّاً (60/20/20)
        notes: r.notes.trim() || null
      }))
    if (rowPayload.length) {
      const { error } = await supabase.from('monthly_report_students').insert(rowPayload)
      if (error) throw error
    }

    // الأنشطة: استبدال كامل (المنجزة فقط)
    await supabase.from('monthly_report_activities').delete().eq('report_id', rid)
    const actPayload = ALL_KEYS.filter(k => acts[k]).map(k => ({ report_id: rid!, activity_key: k, done: true }))
    if (actPayload.length) {
      const { error } = await supabase.from('monthly_report_activities').insert(actPayload)
      if (error) throw error
    }

    toast.add({ title: 'تم حفظ التقرير.', color: 'success', icon: 'i-lucide-save' })
    await refreshList()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

const transitioning = ref(false)
const submitConfirmOpen = ref(false)
async function confirmSubmit() {
  submitConfirmOpen.value = false
  await setStatus('submitted')
}
async function setStatus(status: ReportStatus) {
  if (!report.value) {
    toast.add({ title: 'احفظ التقرير أولاً.', color: 'warning', icon: 'i-lucide-info' })
    return
  }
  transitioning.value = true
  try {
    const patch: Database['public']['Tables']['monthly_reports']['Update'] = { status }
    if (status === 'submitted') patch.submitted_at = new Date().toISOString()
    if (status === 'approved') {
      patch.approved_by = profile.value?.id ?? null
      patch.approved_at = new Date().toISOString()
    }
    const { error } = await supabase.from('monthly_reports').update(patch).eq('id', report.value.id)
    if (error) throw error
    report.value.status = status
    toast.add({ title: status === 'submitted' ? 'أُرسل التقرير للمدير.' : status === 'approved' ? 'تم اعتماد التقرير.' : 'أُعيد فتح التقرير.', color: 'success', icon: 'i-lucide-circle-check' })
    await refreshList()
  } catch (err) {
    handle(err)
  } finally {
    transitioning.value = false
  }
}
</script>

<template>
  <div class="reports">
    <UiPageHeader
      title="التقارير الشهرية"
      subtitle="تقرير الحلقة الشهري: حفظ ومراجعة وغياب وأنشطة لكل طالب — يرفعه المعلّم ويعتمده المدير."
    />

    <!-- لوحة التكريم (للمراجِعين) -->
    <ReportsHonorsBoard v-if="isManager || isReadOnly" />

    <!-- قائمة التقارير -->
    <ClientOnly>
      <div class="card list-card">
        <div class="list-head">
          <h3>
            تقارير الحلقات
            <UBadge
              v-if="submittedCount"
              :label="`${submittedCount} بانتظار الاعتماد`"
              color="warning"
              variant="soft"
              size="sm"
            />
          </h3>
          <UiFilterChips
            v-model="listFilter"
            :options="listChips"
          />
        </div>
        <div
          v-if="listPending"
          class="rcards"
        >
          <UiSkeletonCard
            v-for="i in 6"
            :key="i"
            :icon="false"
            :lines="3"
          />
        </div>
        <UiEmptyState
          v-else-if="!listFiltered.length"
          icon="i-lucide-folder"
          title="لا تقارير في هذا التصنيف"
          description="أنشئ تقريراً جديداً من الأسفل (اختر حلقة وشهراً)."
        />
        <div
          v-else
          class="rcards"
        >
          <button
            v-for="r in listFiltered"
            :key="r.id"
            type="button"
            class="rcard"
            @click="openReport(r)"
          >
            <div class="rc-head">
              <div class="rc-id">
                <div class="rc-name">
                  {{ r.halaqa?.name || '—' }}
                </div>
                <div class="rc-teacher">
                  {{ r.halaqa?.teacher?.full_name || '—' }} · {{ MONTH_NAMES[r.report_month - 1] }} {{ r.report_year }}
                </div>
              </div>
              <UBadge
                :label="REPORT_STATUS[r.status]?.label"
                :color="REPORT_STATUS[r.status]?.color"
                variant="soft"
                size="sm"
              />
            </div>

            <div
              class="rc-hero"
              :class="`ach-${achievementColor(cardOf(r).achievement)}`"
            >
              <div class="rc-num">
                {{ cardOf(r).achievement }}<span class="rc-of">/100</span>
              </div>
              <div class="rc-label">
                {{ gradeLabel(cardOf(r).achievement) }}
              </div>
            </div>
            <div
              class="rc-bar"
              :class="`ach-${achievementColor(cardOf(r).achievement)}`"
            >
              <div
                class="rc-fill"
                :style="{ width: Math.min(100, cardOf(r).achievement) + '%' }"
              />
            </div>

            <div class="rc-meta">
              <span><UIcon
                name="i-lucide-calendar-check"
                class="size-[13px]"
              />انتظام {{ cardOf(r).reg }}%</span>
              <span><UIcon
                name="i-lucide-list-checks"
                class="size-[13px]"
              />أنشطة {{ cardOf(r).actPct }}%</span>
            </div>
          </button>
        </div>
      </div>
    </ClientOnly>

    <!-- المعلّم: تقرير حلقته (تُختار تلقائيّاً) -->
    <div
      v-if="isTeacher"
      class="card pick"
    >
      <div class="pick-fields">
        <div class="pf">
          <label>الحلقة</label>
          <div class="halqa-auto">
            <UIcon
              name="i-lucide-book-open"
              class="size-5"
            />
            {{ myHalqa?.name || 'لا حلقة معيّنة لك' }}
          </div>
        </div>
        <div class="pf sm">
          <label>الشهر</label>
          <UiSelect
            v-model="month"
            :items="monthItems"
            size="lg"
          />
        </div>
        <div class="pf sm">
          <label>السنة</label>
          <UiSelect
            v-model="year"
            :items="yearItems"
            size="lg"
          />
        </div>
        <UButton
          label="تحميل / إنشاء"
          color="primary"
          size="lg"
          icon="i-lucide-folder-open"
          :disabled="!halqaId"
          :loading="loading"
          :ui="{ base: 'rounded-[13px] font-semibold self-end' }"
          @click="load"
        />
      </div>
    </div>

    <!-- المدير/غيره: استقبال واعتماد من القائمة أعلاه -->
    <div
      v-else
      class="card hint-card"
    >
      <UIcon
        name="i-lucide-inbox"
        class="size-5"
      />
      اختر تقريراً من القائمة أعلاه لمراجعته واعتماده. التقارير يرفعها المعلّمون.
    </div>

    <ClientOnly>
      <UiEmptyState
        v-if="!loaded"
        icon="i-lucide-calendar-range"
        :title="isTeacher ? 'اختر الشهر ثم اضغط «تحميل / إنشاء»' : 'افتح تقريراً من القائمة أعلاه'"
        :description="isTeacher ? 'يظهر تقرير حلقتك للتعبئة، ويُنشأ تلقائيّاً عند أول حفظ.' : 'بعد فتح التقرير تستطيع مراجعته واعتماده.'"
      />

      <template v-else>
        <!-- شريط الحالة -->
        <div class="statusbar card">
          <div class="sb-info">
            <UBadge
              :label="report ? REPORT_STATUS[report.status]?.label : 'جديد (لم يُحفظ)'"
              :color="report ? REPORT_STATUS[report.status]?.color : 'neutral'"
              variant="soft"
              size="lg"
            />
            <span class="sb-sub">{{ rows.length }} طالب · {{ MONTH_NAMES[month - 1] }} {{ year }}</span>
            <span
              v-if="teacherLocked"
              class="sb-locked"
            >
              <UIcon
                name="i-lucide-lock"
                class="size-4"
              />
              {{ report?.status === 'approved' ? 'معتمد — للقراءة فقط' : 'أُرسل — بانتظار الاعتماد' }}
            </span>
          </div>
          <div class="sb-actions">
            <UButton
              v-if="rows.length"
              label="تصدير Excel"
              color="neutral"
              variant="outline"
              size="lg"
              icon="i-lucide-download"
              :loading="exporting"
              :ui="{ base: 'rounded-[13px]' }"
              @click="doExport"
            />
            <UButton
              v-if="canEdit"
              label="حفظ"
              color="primary"
              size="lg"
              icon="i-lucide-save"
              :loading="saving"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="save"
            />
            <UButton
              v-if="isTeacher && report && report.status === 'draft'"
              label="إرسال للمدير"
              color="success"
              size="lg"
              icon="i-lucide-send"
              :loading="transitioning"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="submitConfirmOpen = true"
            />
            <UButton
              v-if="canApprove && report && report.status !== 'approved'"
              label="اعتماد"
              color="success"
              size="lg"
              icon="i-lucide-badge-check"
              :loading="transitioning"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="setStatus('approved')"
            />
            <UButton
              v-if="canApprove && report && report.status === 'approved'"
              label="إعادة فتح"
              color="neutral"
              variant="outline"
              size="lg"
              icon="i-lucide-lock-open"
              :loading="transitioning"
              :ui="{ base: 'rounded-[13px]' }"
              @click="setStatus('draft')"
            />
          </div>
        </div>

        <!-- مرجع إعدادات المدير (للقراءة فقط) -->
        <div class="settings-ref">
          <span class="sr-item"><UIcon
            name="i-lucide-book-open"
            class="size-4"
          />صفحات الحفظ المستهدفة: <strong>{{ gradeCfg.target }}</strong></span>
          <span class="sr-item"><UIcon
            name="i-lucide-star"
            class="size-4"
          />النقاط الافتراضية: <strong>{{ gradeCfg.points }}</strong></span>
          <span class="sr-item"><UIcon
            name="i-lucide-calendar-check"
            class="size-4"
          />أيام الدوام الفعلي: <strong>{{ gradeCfg.attendanceDays }}</strong></span>
        </div>

        <!-- إنجاز الحلقة (محسوب) -->
        <div
          v-if="rows.length"
          class="ach card"
          :class="`ach-${achievementColor(halqaAchievement)}`"
        >
          <div class="ach-main">
            <div class="ach-num">
              {{ halqaAchievement }}<span class="ach-of">/100</span>
            </div>
            <div class="ach-meta">
              <div class="ach-title">
                إنجاز الحلقة · {{ gradeLabel(halqaAchievement) }}
              </div>
              <div class="ach-sub">
                متوسط درجات الطلاب (80%) + الأنشطة المنفّذة {{ activitiesPct }}% (20%)
              </div>
            </div>
          </div>
          <div class="ach-bar">
            <div
              class="ach-fill"
              :style="{ width: Math.min(100, halqaAchievement) + '%' }"
            />
          </div>
        </div>

        <!-- جدول الطلاب -->
        <UiEmptyState
          v-if="!rows.length"
          icon="i-lucide-users"
          title="لا طلاب نشطون في هذه الحلقة"
        />
        <div
          v-else
          class="card table-wrap"
        >
          <table>
            <thead>
              <tr>
                <th class="ta-start sticky num-col">
                  #
                </th>
                <th class="ta-start sticky-name">
                  الطالب
                </th>
                <th>من صفحة</th>
                <th>إلى صفحة</th>
                <th>حفظ</th>
                <th>مراجعة لـ</th>
                <th>صفحات المراجعة</th>
                <th>غياب بعذر</th>
                <th>بلا عذر</th>
                <th>النقاط</th>
                <th>الدرجة (محسوبة)</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in rows"
                :key="r.student_id"
              >
                <td class="ta-start sticky num-col muted">
                  {{ i + 1 }}
                </td>
                <td class="ta-start sticky-name strong">
                  {{ r.full_name }}
                </td>
                <td>
                  <input
                    v-model="r.memorization_from"
                    :disabled="!canEdit"
                    type="number"
                    class="cell"
                    dir="ltr"
                  >
                </td>
                <td>
                  <input
                    v-model="r.memorization_to"
                    :disabled="!canEdit"
                    type="number"
                    class="cell"
                    dir="ltr"
                  >
                </td>
                <td class="calc">
                  {{ pagesOf(r) }}
                </td>
                <td>
                  <input
                    v-model="r.review_to"
                    :disabled="!canEdit"
                    type="number"
                    class="cell"
                    dir="ltr"
                  >
                </td>
                <td class="calc">
                  {{ reviewOf(r) }}
                </td>
                <td>
                  <input
                    v-model="r.absence_excused"
                    :disabled="!canEdit"
                    type="number"
                    class="cell"
                    dir="ltr"
                  >
                </td>
                <td>
                  <input
                    v-model="r.absence_unexcused"
                    :disabled="!canEdit"
                    type="number"
                    class="cell"
                    dir="ltr"
                  >
                </td>
                <td>
                  <input
                    v-model="r.monthly_points"
                    :disabled="!canEdit"
                    type="number"
                    class="cell"
                    dir="ltr"
                  >
                </td>
                <td>
                  <span
                    class="grade"
                    :class="`g-${achievementColor(gradeOf(r))}`"
                  >{{ gradeOf(r) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- الأنشطة المصاحبة -->
        <div class="card acts">
          <h3>الأنشطة المصاحبة</h3>
          <div class="act-groups">
            <div
              v-for="g in ACTIVITY_GROUPS"
              :key="g.title"
              class="act-group"
            >
              <div class="ag-title">
                {{ g.title }}
              </div>
              <label
                v-for="k in g.keys"
                :key="k.key"
                class="act-item"
              >
                <UCheckbox
                  v-model="acts[k.key]"
                  :disabled="!canEdit"
                />
                <span>{{ k.label }}</span>
              </label>
            </div>
          </div>
          <UFormField
            label="ملاحظات الأنشطة"
            class="mt"
          >
            <UTextarea
              v-model="meta.activities_notes"
              :rows="2"
              :disabled="!canEdit"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
        </div>

        <!-- ملاحظات عامّة -->
        <div class="card">
          <UFormField label="ملاحظات عامّة على الحلقة">
            <UTextarea
              v-model="meta.general_notes"
              :rows="3"
              :disabled="!canEdit"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
        </div>
      </template>
    </ClientOnly>

    <!-- تأكيد الإرسال (يقفل التعديل) -->
    <UiConfirmModal
      :open="submitConfirmOpen"
      title="إرسال التقرير للمدير"
      message="بعد الإرسال يُقفل التقرير ولن تتمكّن من تعديله. هل أنت متأكّد من إرساله للاعتماد؟"
      confirm-label="إرسال"
      confirm-color="primary"
      confirm-icon="i-lucide-send"
      :loading="transitioning"
      @confirm="confirmSubmit"
      @update:open="(v) => { if (!v) submitConfirmOpen = false }"
    />
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px; margin-bottom: 18px; }

.list-card { padding: 0; }
.list-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 18px 20px; border-bottom: 1px solid var(--line); }
.list-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }

/* بطاقات مراجعة التقارير (§4.17د) */
.rcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; padding: 20px; }
.rcard { text-align: start; background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 12px; }
.rcard:hover { border-color: var(--blue); box-shadow: var(--shadow); transform: translateY(-2px); }
.rc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.rc-name { font-size: 16px; font-weight: 700; color: var(--ink); }
.rc-teacher { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
.rc-hero { display: flex; align-items: baseline; gap: 10px; }
.rc-num { font-size: 34px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: var(--ink); }
.rc-of { font-size: 15px; font-weight: 600; color: var(--ink-3); }
.rc-label { font-size: 14px; font-weight: 700; }
.ach-success .rc-num, .ach-success .rc-label { color: var(--green-ink); }
.ach-info .rc-num, .ach-info .rc-label { color: var(--blue-ink); }
.ach-error .rc-num, .ach-error .rc-label { color: var(--err); }
.rc-bar { height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.rc-fill { height: 100%; border-radius: 999px; }
.ach-success .rc-fill { background: var(--green); }
.ach-info .rc-fill { background: var(--blue); }
.ach-error .rc-fill { background: var(--err); }
.rc-meta { display: flex; gap: 16px; flex-wrap: wrap; }
.rc-meta span { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--ink-2); }

.halqa-auto { display: flex; align-items: center; gap: 9px; height: 48px; padding: 0 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); font-size: 15.5px; font-weight: 600; color: var(--ink); }
.hint-card { display: flex; align-items: center; gap: 10px; color: var(--ink-2); font-size: 15px; }
.pick-fields { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pf { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 8px; }
.pf.sm { flex: 0 0 140px; min-width: 120px; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }

.statusbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.sb-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sb-sub { font-size: 14px; color: var(--ink-2); }
.sb-locked { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.settings-ref { display: flex; gap: 10px 22px; flex-wrap: wrap; padding: 12px 18px; margin-bottom: 18px; background: var(--surface-2); border: 1px dashed var(--line-2); border-radius: 14px; }
.sr-item { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; color: var(--ink-2); }
.sr-item strong { color: var(--ink); font-weight: 700; }
.sb-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.table-wrap { overflow-x: auto; padding: 0; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 900px; }
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 12px 10px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; white-space: nowrap; text-align: center; }
.table-wrap th.ta-start { text-align: start; }
.table-wrap td { padding: 8px 10px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); white-space: nowrap; }
.ta-start { text-align: start; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.num-col { width: 40px; }
.sticky { position: sticky; inset-inline-start: 0; background: var(--surface); z-index: 1; }
.sticky-name { position: sticky; inset-inline-start: 40px; background: var(--surface); z-index: 1; }
thead .sticky, thead .sticky-name { background: var(--surface-2); }
.calc { font-weight: 700; color: var(--green-ink); background: var(--green-soft); }
.grade { display: inline-flex; align-items: center; justify-content: center; min-width: 42px; height: 30px; padding: 0 10px; border-radius: 999px; font-weight: 700; font-size: 13.5px; font-variant-numeric: tabular-nums; }
.g-success { background: var(--green-soft); color: var(--green-ink); }
.g-info { background: var(--blue-soft); color: var(--blue-ink); }
.g-error { background: var(--err-soft); color: var(--err); }

.ach { padding: 20px 24px; margin-bottom: 18px; border-inline-start: 5px solid var(--line-2); }
.ach-success { border-inline-start-color: var(--green); }
.ach-info { border-inline-start-color: var(--blue); }
.ach-error { border-inline-start-color: var(--err); }
.ach-main { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.ach-num { font-size: 40px; font-weight: 800; color: var(--ink); line-height: 1; font-variant-numeric: tabular-nums; }
.ach-of { font-size: 18px; font-weight: 600; color: var(--ink-3); }
.ach-title { font-size: 17px; font-weight: 700; color: var(--ink); }
.ach-sub { font-size: 13px; color: var(--ink-3); margin-top: 5px; }
.ach-bar { height: 9px; border-radius: 999px; background: var(--surface-3); overflow: hidden; margin-top: 16px; }
.ach-fill { height: 100%; border-radius: 999px; background: var(--green); transition: width .4s ease; }
.ach-info .ach-fill { background: var(--blue); }
.ach-error .ach-fill { background: var(--err); }
.cell { width: 70px; height: 38px; padding: 0 8px; border-radius: 9px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 14px; text-align: center; outline: none; }
.cell:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.cell:disabled { opacity: .6; cursor: not-allowed; }

.acts h3 { margin: 0 0 16px; font-size: 17px; font-weight: 700; color: var(--ink); }
.act-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 18px; }
.ag-title { font-size: 13px; font-weight: 700; color: var(--ink-3); margin-bottom: 10px; }
.act-item { display: flex; align-items: center; gap: 9px; padding: 7px 0; font-size: 14.5px; color: var(--ink); cursor: pointer; }
.mt { margin-top: 18px; }

@media (max-width: 620px) { .pf, .pf.sm { flex: 1 1 100%; } }
</style>
