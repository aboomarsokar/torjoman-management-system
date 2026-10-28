<script setup lang="ts">
/**
 * إنجازُ حلقتي — الإنجازُ القرآنيّ للمعلّم يعمل بلا إنترنت (البند 14 — نمطُ الصحابة، 2026-10-27).
 * تُصيَّر في المتصفّح وتُخزَّن في عامل الخدمة، والبياناتُ من نسخة الجهاز: الشهرُ الجاري والسابق وطلابُهما ومراجعُ
 * المصحف. البطاقاتُ ونافذةُ الرصد هي نفسُها في الشاشة المتّصلة؛ و«حفظ» يُكتب على الجهاز ويُرفع في الخلفية طالباً طالباً،
 * وعلى البطاقة «بانتظار الرفع» حتى يُرفع. **الإرسالُ للاعتماد متّصلاً وحده وبعد رفع كلّ السجلّات** (القرارُ المعتمَد).
 */
import { OFFLINE_QURAN } from '~/constants/offline'
import type { StudentMonthRow } from '~/utils/quran/month'
import { summarizeOutcomes } from '~/utils/quran/month'
import type { Outcome } from '~/utils/quran/plan'
import type { RecordInput } from '~/utils/quran/screen'
import { cardAction, periodFromQuery, visibleRows } from '~/utils/quran/screen'
import { gazaToday, periodLabel } from '~/utils/reportWindow'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'إنجاز حلقتي — ترجمان', robots: 'noindex' })

const {
  ready, access, months, queue, reference, start, year, month, halaqa, rows, report, status, canEdit,
  openingNote, pendingStudents, save, submitBlock, submit, statusText, retrying
} = useOfflineQuran()
const { state: readiness } = useOfflineReadiness(OFFLINE_QURAN)
const { isReadOnly } = usePermissions()
// `?y=&m=` (إشعارُ الإعادة، «يحتاج متابعتك») يفتح ذلك الشهرَ إن كان على الجهاز
const route = useRoute()
onMounted(async () => {
  await start()
  const linked = periodFromQuery(route.query.y, route.query.m, gazaToday())
  if (linked && months.value.some(m => m.year === linked.year && m.month === linked.month)) {
    year.value = linked.year
    month.value = linked.month
  }
})
// غيرُ المعلّم متّصلاً يذهب إلى الشاشة المتّصلة
watch(access, (a) => {
  if (a === 'other') navigateTo({ path: '/reports', query: route.query }, { replace: true })
})

const monthItems = computed(() => months.value.map(m => ({ label: `الشهر ${String(m.month).padStart(2, '0')}`, value: `${m.year}-${m.month}` })))
const monthPick = computed<string>({
  get: () => `${year.value}-${month.value}`,
  set: (v) => {
    const [y, m] = v.split('-').map(Number)
    year.value = y!
    month.value = m!
  }
})
const period = computed(() => periodLabel(year.value, month.value))

// الترشيح: يُمسح مع تبديل الشهر، ويُرفع إن فرغت خانتُه
const outcomeFilter = ref<Outcome | null>(null)
const nameQuery = ref('')
watch([year, month], () => {
  outcomeFilter.value = null
  nameQuery.value = ''
})
const summary = computed(() => summarizeOutcomes(rows.value))
watch(summary, (s) => {
  if (outcomeFilter.value && s[outcomeFilter.value] === 0) outcomeFilter.value = null
})
const shown = computed(() => visibleRows(rows.value, outcomeFilter.value, nameQuery.value))

// أسماءُ الطلاب لِما رفضته الإدارة (قد يكون من الشهر الآخر)
const studentNames = computed(() => new Map(months.value.flatMap(m => (m.inputs?.students ?? []).map(s => [s.id, s.full_name] as const))))
const rejected = computed(() => queue.rejected.value.map(e => ({
  key: e.key,
  label: `${studentNames.value.get(e.studentId) ?? 'طالب'} · الشهر ${String(e.month).padStart(2, '0')}`,
  error: e.error
})))

// ── نافذة الرصد ──
const editing = ref<StudentMonthRow | null>(null)
const editingReadOnly = ref(false)
const recordOpen = computed({
  get: () => editing.value !== null,
  set: (v) => {
    if (!v) editing.value = null
  }
})
function openCard(row: StudentMonthRow) {
  editingReadOnly.value = !canEdit.value || row.recordedElsewhere
  editing.value = row
}
const toast = useToast()
const { handle } = useErrorHandler()
const saving = ref(false)
async function onSave(input: RecordInput) {
  const row = editing.value
  if (!row || row.recordedElsewhere) return
  saving.value = true
  try {
    if (await save(row.studentId, input)) {
      editing.value = null
      toast.add({
        title: queue.online.value ? `حُفظ رصدُ ${row.name}، ويُرفع الآن.` : `حُفظ رصدُ ${row.name} على جهازك — يُرفع حين يعود الاتصال.`,
        color: 'success', icon: 'i-lucide-circle-check'
      })
    }
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}
const noDecision = () => Promise.resolve(false)
</script>

<template>
  <div class="tq">
    <OfflineSyncStatus
      v-if="access === 'teacher'"
      :text="statusText"
      :online="queue.online.value"
      :pending="queue.pending.value.length"
      :syncing="queue.syncing.value"
      :retrying="retrying"
      :readiness="readiness"
      @retry="queue.flush()"
    />
    <OfflineRejectedDays
      v-if="rejected.length"
      title="سجلّاتٌ لم تقبلها الإدارة"
      :entries="rejected"
      @retry="queue.retry"
      @discard="queue.discard"
    />

    <div
      v-if="!ready"
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
      v-else-if="!months.length"
      icon="i-lucide-wifi-off"
      title="افتح هذه الشاشة مرّةً وأنت متّصل"
      description="يُحفظ الشهرُ الجاري والسابقُ لحلقتك على جهازك عند أوّل فتحٍ متّصل، ثمّ تعمل بلا إنترنت."
    >
      <UButton
        v-if="queue.online.value"
        to="/login"
        label="تسجيل الدخول"
        color="primary"
        :ui="{ base: 'rounded-xl min-h-11' }"
      />
    </UiEmptyState>
    <UiEmptyState
      v-else-if="!halaqa"
      icon="i-lucide-book-open"
      title="لا حلقة معيّنة لك"
    />
    <UiEmptyState
      v-else-if="!reference.ready.value"
      icon="i-lucide-cloud-off"
      title="مراجعُ المصحف ليست على جهازك بعد"
      description="اتّصل بالإنترنت وافتح هذه الشاشة مرّةً لتُحفظ."
    />

    <template v-else>
      <section class="card pick">
        <div class="head">
          <small>{{ halaqa.name }}</small>
          <UTabs
            v-if="monthItems.length > 1"
            v-model="monthPick"
            :items="monthItems"
            :content="false"
            size="lg"
            class="months"
          />
          <b v-else>الشهر {{ String(month).padStart(2, '0') }}</b>
        </div>
        <UiSearchField
          v-if="rows.length"
          v-model="nameQuery"
          placeholder="ابحث باسم الطالب…"
          :shown="shown.length"
          :total="rows.length"
          class="w-full"
        />
      </section>

      <!-- قبل يوم فتح الشهر لا يُدخل المعلّمُ إنجازَه (قرار المستخدم 2026-10-28) -->
      <div
        v-if="openingNote"
        class="opening"
        role="status"
      >
        <UIcon
          name="i-lucide-calendar-clock"
          class="size-5 shrink-0"
        />
        <span>{{ openingNote }}</span>
      </div>

      <QuranMonthBar
        :status="status"
        :return-note="report?.return_note ?? null"
        :period="period"
        :can-submit="!isReadOnly"
        :submit-block="submitBlock"
        :can-decide="false"
        :unrecorded="summary.unrecorded"
        :total="rows.length"
        :submit="submit"
        :approve="noDecision"
        :return-with-note="noDecision"
      />

      <UiEmptyState
        v-if="!rows.length"
        icon="i-lucide-users"
        title="لا طلاب نشطون في هذه الحلقة"
      />
      <template v-else>
        <QuranOutcomeStrip
          v-model="outcomeFilter"
          :summary="summary"
          :total="rows.length"
          :halaqa-name="halaqa.name"
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
            :queued="pendingStudents.has(r.studentId)"
            @open="openCard(r)"
          />
        </div>
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
/* يملأ عرضَ المحتوى كسائر شاشات المعلّم (2026-10-27) */
.tq { display: flex; flex-direction: column; gap: 14px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 18px; }
.pick { display: flex; flex-direction: column; gap: 14px; }
.opening { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 14px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); font-size: 14.5px; font-weight: 600; line-height: 1.6; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.head small { font-size: 14px; color: var(--ink-2); font-weight: 600; }
.head b { font-size: 15.5px; font-weight: 700; color: var(--ink); }
.months { min-width: 220px; }
.list { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); overflow: hidden; }
.list > * + * { border-top: 1px solid var(--line); }
</style>
