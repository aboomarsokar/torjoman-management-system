<script setup lang="ts">
/**
 * الإنجاز القرآني — رصدُ حفظ الشهر لكلّ طالب بالسورة والآية، وإرسالُه، واعتمادُه.
 * المعلم يرصد حلقته ويُرسل الشهرَ ابتداءً من يوم فتحه؛ المشرفُ الميدانيّ للحلقة (والمديرُ الإداري، والمديرةُ
 * لحلقات البنات احتياطاً) يعتمد المُرسَل أو يُعيده بملاحظة، ويُعيد فتحَ المعتمَد؛ المديرُ الفنيّ ومشرفُ المشروع
 * يطّلعان. غيرُ المعلم يرى قائمةَ حلقاته بحالة الشهر حتى يختار حلقة. أعلامُ الواجهة تجربةٌ والحكمُ للقاعدة.
 */
import type { Database } from '~/types/database.types'
import type { StudentMonthRow } from '~/utils/quran/month'
import { canApproveReport, summarizeOutcomes } from '~/utils/quran/month'
import type { Outcome } from '~/utils/quran/plan'
import type { RecordInput, ReportStatus } from '~/utils/quran/screen'
import { EXPORT_HEADERS, canEditMonth, cardAction, defaultPeriod, exportRows, periodFromQuery, visibleRows } from '~/utils/quran/screen'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الإنجاز القرآني — ترجمان' })

type HalaqaRow = Pick<Database['public']['Tables']['halaqat']['Row'], 'id' | 'name' | 'gender' | 'supervisor_id'>

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { exportXlsx } = useExport()
const { isTeacher, isReadOnly, isFieldSupervisor } = usePermissions()
const reference = useQuranReference()

const today = gazaToday()
const now = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
// `?y=YYYY&m=MM` يفتح شهراً بعينه ويغلب كلَّ شيء، وإلا فالشهرُ المنتظَر (`defaultPeriod`)
const route = useRoute()
const linked = periodFromQuery(route.query.y, route.query.m, today)
const initial = linked ?? defaultPeriod(today, { previousStatus: null })
const year = ref(initial.year)
const month = ref(initial.month)
const halaqaId = ref<string | null>(null)
let periodSettled = !!linked

// المعلم حلقتُه، والمشرفُ الميدانيّ حلقاتُه وحدَها، وغيرُهما ما تسمح به RLS — النشطةُ وحدَها
// الحلقاتُ تُجلب في المتصفّح: قبل التركيب لا يُحكم بـ«لا حلقات» (كان الخادمُ يرسمها فيخالف التهيئة)
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
const { data: halaqat, pending: halaqatPending } = useLazyAsyncData<HalaqaRow[]>('quran-halaqat', async () => {
  if (!role.value) return []
  let query = supabase.from('halaqat').select('id, name, gender, supervisor_id').eq('status', 'active').order('name')
  if (role.value === 'teacher') query = query.eq('teacher_id', profile.value?.id ?? '')
  else if (role.value === 'field_supervisor') query = query.eq('supervisor_id', profile.value?.id ?? '')
  const { data, error } = await query
  if (error) handle(error)
  return data ?? []
}, { server: false, default: () => [], watch: [role] })

/** المعلم: السابقُ إن كان مسوّدةً معلّقة وإلا الجاري (مرّةً، وما لم يغيّر الشهرَ بيده). */
async function settleTeacherPeriod(hid: string) {
  periodSettled = true
  const prev = shiftMonth(now.year, now.month, -1)
  const { data, error } = await supabase.from('monthly_reports').select('status')
    .eq('halaqa_id', hid).eq('report_year', prev.year).eq('report_month', prev.month).maybeSingle()
  if (error) handle(error)
  const p = defaultPeriod(today, { previousStatus: data?.status ?? 'none' })
  if (year.value === initial.year && month.value === initial.month) {
    year.value = p.year
    month.value = p.month
  }
}

watch(halaqat, async (list) => {
  if (!isTeacher.value) {
    if (!list.some(h => h.id === halaqaId.value)) halaqaId.value = null
    return
  }
  const id = list[0]?.id ?? null
  if (id && !periodSettled) await settleTeacherPeriod(id)
  halaqaId.value = id
}, { immediate: true })

// حالةُ الشهر لكلّ حلقة (قائمةُ غير المعلم)
const { data: monthStatuses, refresh: refreshStatuses } = useLazyAsyncData<Record<string, ReportStatus>>('quran-month-statuses', async () => {
  if (!role.value || role.value === 'teacher') return {}
  const { data, error } = await supabase.from('monthly_reports').select('halaqa_id, status')
    .eq('report_year', year.value).eq('report_month', month.value)
  if (error) handle(error)
  return Object.fromEntries((data ?? []).map(r => [r.halaqa_id, r.status]))
}, { server: false, default: () => ({}), watch: [role, year, month] })
const listItems = computed(() => halaqat.value.map(h => ({ id: h.id, name: h.name, status: monthStatuses.value[h.id] ?? null })))
const halaqaItems = computed(() => halaqat.value.map(h => ({ label: h.name, value: h.id })))
const halaqa = computed(() => halaqat.value.find(h => h.id === halaqaId.value) ?? null)

const { report, rows, loading, load, saveRecord, submit, approve, returnWithNote } = useQuranMonth(halaqaId, year, month)
watch([halaqaId, year, month], load, { immediate: true })

const status = computed<ReportStatus | null>(() => report.value?.status ?? null)
// جنسُ الحلقة المجهول لا يمنح المديرةَ الإدارية شيئاً (والقاعدةُ تحكم كذلك)
const canApproveHere = computed(() => !!halaqa.value && canApproveReport(role.value, profile.value?.id ?? null, {
  gender: halaqa.value.gender ?? 'male', supervisor_id: halaqa.value.supervisor_id
}))
const canEdit = computed(() => canEditMonth({
  readOnly: isReadOnly.value, isTeacher: isTeacher.value, canApprove: canApproveHere.value, status: status.value,
  isFieldSupervisor: isFieldSupervisor.value
}))

// الترشيح: يُمسح مع تبديل الحلقة/الشهر، ويُرفع إن فرغت خانتُه
const outcomeFilter = ref<Outcome | null>(null)
const nameQuery = ref('')
watch([halaqaId, year, month], () => {
  outcomeFilter.value = null
  nameQuery.value = ''
})
const summary = computed(() => summarizeOutcomes(rows.value))
watch(summary, (s) => {
  if (outcomeFilter.value && s[outcomeFilter.value] === 0) outcomeFilter.value = null
})
const shown = computed(() => visibleRows(rows.value, outcomeFilter.value, nameQuery.value))

const period = computed(() => periodLabel(year.value, month.value))
// الإرسالُ معطَّلٌ قبل يوم الفتح، وبلا رأسِ شهرٍ (لم يُرصد أحدٌ بعد)
const submitBlock = computed(() => {
  if (!isSubmittable(year.value, month.value, today)) return `يُرسَل ابتداءً من ${formatDay(openingDay(year.value, month.value))}.`
  return report.value ? null : 'ارصد طالباً واحداً على الأقلّ قبل الإرسال.'
})

// ── نافذة الرصد ──
const editing = ref<StudentMonthRow | null>(null)
const editingReadOnly = ref(false)
const recordOpen = computed({
  get: () => editing.value !== null,
  set: (v) => {
    if (!v) editing.value = null
  }
})
const saving = ref(false)
function openCard(row: StudentMonthRow) {
  editingReadOnly.value = !canEdit.value || row.recordedElsewhere
  editing.value = row
}
async function onSave(input: RecordInput) {
  const row = editing.value
  // رصدُ الحلقة السابقة للعرض فقط (والقاعدةُ ترفضه كذلك)
  if (!row || row.recordedElsewhere) return
  saving.value = true
  const ok = await saveRecord(row.studentId, input)
  saving.value = false
  if (ok) {
    editing.value = null
    refreshStatuses() // أوّلُ رصدٍ يُنشئ مسوّدةَ الشهر فتتغيّر حالةُ الحلقة في القائمة
    toast.add({ title: `حُفظ رصدُ ${row.name}`, color: 'success', icon: 'i-lucide-circle-check' })
  }
}

const exporting = ref(false)
async function doExport() {
  exporting.value = true
  try {
    await exportXlsx(`الإنجاز-القرآني-${period.value}`, EXPORT_HEADERS, exportRows(rows.value, reference.surahName), 'الإنجاز')
  } catch (err) {
    handle(err)
  } finally {
    exporting.value = false
  }
}

const pending = computed(() => !role.value || halaqatPending.value || loading.value)
</script>

<template>
  <div class="qa">
    <UiPageHeader
      title="الإنجاز القرآني"
      subtitle="رصدُ حفظ الشهر لكلّ طالب من سورةٍ وآيةٍ إلى سورةٍ وآية، ثم إرسالُه للاعتماد."
    >
      <template #actions>
        <!-- حاضرٌ من أوّل رسمٍ (خادماً ومتصفّحاً) ومعطّلٌ حتى تصل الصفوف — فلا يقفز ولا يخالف التهيئة -->
        <UButton
          label="تصدير Excel"
          icon="i-lucide-file-spreadsheet"
          color="neutral"
          variant="outline"
          size="lg"
          :loading="exporting"
          :disabled="!halaqaId || !rows.length"
          :title="halaqaId ? undefined : 'اختر حلقةً للتصدير'"
          :ui="{ base: 'rounded-[13px]' }"
          @click="doExport"
        />
      </template>
    </UiPageHeader>

    <UiEmptyState
      v-if="mounted && role && !halaqatPending && !halaqat.length"
      icon="i-lucide-book-open"
      :title="isTeacher ? 'لا حلقة معيّنة لك' : 'لا حلقات في نطاقك'"
    />

    <template v-else>
      <QuranMonthFilters
        v-model:halaqa="halaqaId"
        v-model:year="year"
        v-model:month="month"
        v-model:query="nameQuery"
        :is-teacher="isTeacher"
        :halaqa-name="halaqa?.name ?? ''"
        :halaqa-items="halaqaItems"
        :max="now"
        :shown="shown.length"
        :total="rows.length"
      />

      <QuranHalaqaList
        v-if="mounted && !halaqaId && !isTeacher && !halaqatPending"
        :items="listItems"
        @pick="halaqaId = $event"
      />

      <template v-else-if="halaqaId">
        <QuranMonthBar
          :status="status"
          :return-note="report?.return_note ?? null"
          :period="period"
          :can-submit="isTeacher && !isReadOnly"
          :submit-block="submitBlock"
          :can-decide="canApproveHere && !isReadOnly"
          :unrecorded="summary.unrecorded"
          :total="rows.length"
          :loading="loading"
          :submit="submit"
          :approve="approve"
          :return-with-note="returnWithNote"
          @changed="refreshStatuses()"
        />

        <div
          v-if="pending"
          class="stack"
          aria-busy="true"
        >
          <UiSkeletonCard
            v-for="i in 3"
            :key="i"
            :icon="false"
          />
        </div>
        <UiEmptyState
          v-else-if="!rows.length"
          icon="i-lucide-users"
          title="لا طلاب نشطون في هذه الحلقة"
        />
        <template v-else>
          <QuranOutcomeStrip
            v-model="outcomeFilter"
            :summary="summary"
            :total="rows.length"
            :halaqa-name="halaqa?.name ?? ''"
          />
          <UiEmptyState
            v-if="!shown.length"
            icon="i-lucide-search-x"
            :title="`لا طالبَ يطابق «${nameQuery}»`"
          />
          <div
            v-else
            class="list"
          >
            <QuranStudentCard
              v-for="r in shown"
              :key="r.studentId"
              :row="r"
              :status="status"
              :action="cardAction(!!r.record, canEdit, r.recordedElsewhere)"
              :surah-name="reference.surahName"
              @open="openCard(r)"
            />
          </div>
        </template>
      </template>
    </template>

    <QuranRecordModal
      v-model:open="recordOpen"
      :row="editing"
      :read-only="editingReadOnly"
      :saving="saving"
      @save="onSave"
    />
  </div>
</template>

<style scoped>
.stack { display: flex; flex-direction: column; gap: 12px; }
.list { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); overflow: hidden; }
.list > * + * { border-top: 1px solid var(--line); }
</style>
