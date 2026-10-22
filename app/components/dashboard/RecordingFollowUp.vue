<script setup lang="ts">
/**
 * «متابعة الرصد» في لوحتَي المدير الفنيّ والمديرة الإدارية (طلب المستخدم 2026-10-22): أيُّ الحلقات رصدت حضورها
 * وأيُّها فاتها، وحالُ رصد الشهر القرآنيّ المستحقّ — لمعرفة المقصّر من المنجز بنظرة. سطرٌ كثيفٌ لكلّ حلقة:
 * شريطُ أيام الدوام الستة الأخيرة (بياناتٌ يوماً بيوم)، وعددُ أيام الشهر المرصودة، وشارةُ الرصد الشهريّ،
 * ثم الانتقالُ إلى الحضور أو الرصد والتواصلُ مع المعلم بواتس أب. البياناتُ من `halaqat_recording_status` (طلبٌ واحد).
 */
import type { Database } from '~/types/database.types'
import { whatsappLink } from '~/utils/halaqatAchievement'
import type { DayState, RecordingRow, ReportState } from '~/utils/recordingStatus'
import { daysLeft, isLagging, parseRecent, recordingSummary, reportState, sortByLag, weekdayName, weekdayShort } from '~/utils/recordingStatus'

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
// قسمُ المديرة الإدارية إناثٌ كلُّه: التسمياتُ بالمؤنّث
const { isWomenAdmin: fem } = usePermissions()

const { data, pending } = useLazyAsyncData<RecordingRow[]>('halaqat-recording-status', async () => {
  const { data: rows, error } = await supabase.rpc('halaqat_recording_status')
  if (error) {
    handle(error)
    return []
  }
  return rows ?? []
}, { server: false, default: () => [] })

const all = computed(() => sortByLag(data.value ?? []))
const summary = computed(() => recordingSummary(data.value ?? []))
const view = ref<'all' | 'lag'>('all')
const shown = computed(() => view.value === 'lag' ? all.value.filter(isLagging) : all.value)
const filterOptions = computed(() => [
  { value: 'all' as const, label: `الكل (${summary.value.halqat})` },
  { value: 'lag' as const, label: `المقصّرة (${summary.value.lagging})` }
])

const DAY_META: Record<DayState, { icon: string | null, word: string }> = {
  held: { icon: 'i-lucide-check', word: 'رُصد' },
  missed: { icon: 'i-lucide-x', word: 'فات بلا رصد' },
  today: { icon: null, word: 'اليوم — لم يُرصد بعد' },
  before: { icon: null, word: 'قبل بدء الحلقة' }
}
const REPORT_META: Record<ReportState, { color: 'success' | 'info' | 'error' | 'warning', text: (r: RecordingRow) => string }> = {
  approved: { color: 'success', text: () => 'معتمَد' },
  submitted: { color: 'info', text: () => 'مُرسَل' },
  late: { color: 'error', text: r => r.report_status === 'draft' ? 'متأخّر — مسوّدة' : 'متأخّر — لم يبدأ' },
  due: { color: 'warning', text: (r) => {
    const n = daysLeft(r)
    return n === 0 ? 'مستحقٌّ اليوم' : `مستحقّ — بقي ${n} ${n === 1 ? 'يوم' : n === 2 ? 'يومان' : 'أيام'}`
  } }
}
const dayNum = (d: string) => Number(d.slice(8, 10))
const teacherWord = computed(() => fem.value ? 'المعلّمة' : 'المعلّم')
/** تمييزُ العدد بعد «من»: حلقةٍ · حلقتين · حلقات · حلقة. */
const halqatWord = (n: number) => n === 1 ? 'حلقة' : n === 2 ? 'حلقتين' : n <= 10 ? 'حلقات' : 'حلقة'
</script>

<template>
  <section class="card rf">
    <div class="rf-head">
      <h3>متابعة الرصد</h3>
      <UiFilterChips
        v-model="view"
        :options="filterOptions"
      />
    </div>

    <UiSkeletonLines
      v-if="pending && !all.length"
      :fields="3"
    />
    <UiEmptyState
      v-else-if="!all.length"
      icon="i-lucide-calendar-check"
      title="لا حلقاتٍ نشطة في نطاقك"
    />
    <template v-else>
      <p class="rf-sum">
        اليوم رُصد حضورُ <b>{{ summary.today }}</b> من <b>{{ summary.halqat }}</b> {{ halqatWord(summary.halqat) }}
        <span class="dot">·</span>
        <b :class="{ bad: summary.lagging }">{{ summary.lagging }}</b> مقصّرة
        <span class="dot">·</span>
        رصدٌ شهريّ متأخّر في <b :class="{ bad: summary.lateReports }">{{ summary.lateReports }}</b>
      </p>

      <p
        v-if="view === 'lag' && !shown.length"
        class="rf-clean"
      >
        <UIcon
          name="i-lucide-circle-check"
          class="size-5"
        /> لا حلقةَ مقصّرة — كلُّها رصدت أيامها وشهرَها في المهلة.
      </p>

      <ul class="rf-rows">
        <li
          v-for="r in shown"
          :key="r.halaqa_id"
          class="rf-row"
          :class="{ lag: isLagging(r) }"
        >
          <div class="rf-who">
            <span class="rf-name">{{ r.halaqa_name }}</span>
            <span class="rf-teacher">{{ teacherWord }}: {{ r.teacher_name ?? '—' }}</span>
          </div>

          <ol
            class="rf-days"
            :aria-label="`رصد الحضور في أيام الدوام الأخيرة — ${r.halaqa_name}`"
          >
            <li
              v-for="d in parseRecent(r.recent)"
              :key="d.day"
              class="rf-day"
              :class="`s-${d.state}`"
              :title="`${weekdayName(d.day)} ${dayNum(d.day)}: ${DAY_META[d.state].word}`"
              :aria-label="`${weekdayName(d.day)} ${dayNum(d.day)}: ${DAY_META[d.state].word}`"
            >
              <span class="rf-dl">{{ weekdayShort(d.day) }}</span>
              <span class="rf-dn">
                <UIcon
                  v-if="DAY_META[d.state].icon"
                  :name="DAY_META[d.state].icon!"
                  class="size-3.5"
                />
                <template v-else>{{ dayNum(d.day) }}</template>
              </span>
            </li>
          </ol>

          <div class="rf-facts">
            <span
              class="rf-month"
              :class="{ bad: r.missed_days.length }"
            >رُصد <b>{{ r.recorded_days }}</b> من <b>{{ r.expected_days }}</b> {{ r.expected_days > 2 && r.expected_days <= 10 ? 'أيام' : 'يوماً' }} هذا الشهر</span>
            <UBadge
              :label="`رصد ${r.report_month}/${r.report_year}: ${REPORT_META[reportState(r)].text(r)}`"
              :color="REPORT_META[reportState(r)].color"
              variant="soft"
            />
          </div>

          <div class="rf-acts">
            <UButton
              :to="`/attendance?h=${r.halaqa_id}`"
              label="الحضور"
              icon="i-lucide-calendar-check"
              color="neutral"
              variant="outline"
              size="sm"
              :ui="{ base: 'rounded-[10px] min-h-9' }"
            />
            <UButton
              :to="`/reports?h=${r.halaqa_id}&y=${r.report_year}&m=${r.report_month}`"
              label="رصد الشهر"
              icon="i-lucide-book-marked"
              color="neutral"
              variant="outline"
              size="sm"
              :ui="{ base: 'rounded-[10px] min-h-9' }"
            />
            <UButton
              v-if="whatsappLink(r.teacher_whatsapp || r.teacher_phone)"
              :to="whatsappLink(r.teacher_whatsapp || r.teacher_phone)!"
              target="_blank"
              rel="noopener"
              icon="i-simple-icons-whatsapp"
              color="success"
              variant="soft"
              size="sm"
              :aria-label="`واتس أب ${teacherWord} ${r.teacher_name ?? ''}`"
              :ui="{ base: 'rounded-[10px] min-h-9 min-w-9 justify-center' }"
            />
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
.rf { padding: 20px 22px; margin-bottom: 18px; }
.rf-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.rf-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.rf-sum { margin: 0 0 10px; font-size: 14px; color: var(--ink-2); line-height: 1.9; }
.rf-sum b { color: var(--ink); font-variant-numeric: tabular-nums; }
.rf-sum b.bad { color: var(--err); }
.dot { margin: 0 6px; color: var(--ink-3); }
.rf-clean { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; padding: 14px; border-radius: 13px; background: var(--green-soft); color: var(--green-ink); font-size: 14px; font-weight: 600; }

.rf-rows { list-style: none; margin: 0; padding: 0; }
.rf-row { display: grid; grid-template-columns: minmax(150px, 1.2fr) auto minmax(210px, 1.4fr) auto; align-items: center; gap: 10px 18px; padding: 12px 6px; border-top: 1px solid var(--line); }
.rf-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rf-name { font-size: 15px; font-weight: 600; color: var(--ink); }
.rf-teacher { font-size: 12.5px; color: var(--ink-3); overflow-wrap: anywhere; }

.rf-days { display: flex; gap: 5px; list-style: none; margin: 0; padding: 0; }
.rf-day { width: 34px; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.rf-dl { font-size: 11px; color: var(--ink-3); line-height: 1; }
.rf-dn { width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.s-held .rf-dn { background: var(--green-soft); color: var(--green-ink); }
.s-missed .rf-dn { background: var(--err-soft); color: var(--err); }
.s-today .rf-dn { border: 1.5px dashed var(--ink-3); color: var(--ink-2); }
.s-before .rf-dn { background: var(--surface-2); color: var(--ink-3); opacity: .55; }

.rf-facts { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; }
.rf-month { font-size: 13px; color: var(--ink-2); }
.rf-month b { color: var(--ink); font-variant-numeric: tabular-nums; }
.rf-month.bad b:first-child { color: var(--err); }
.rf-acts { display: flex; gap: 6px; justify-content: flex-end; }

@media (max-width: 980px) {
  .rf-row { grid-template-columns: 1fr auto; }
  .rf-days { grid-column: 1 / -1; order: 3; }
  .rf-facts { grid-column: 1 / -1; order: 4; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
  .rf-acts { order: 2; }
}
@media (max-width: 560px) {
  .rf { padding: 16px; }
  .rf-row { grid-template-columns: 1fr; padding: 14px 2px; }
  .rf-acts { order: 5; justify-content: flex-start; }
  .rf-days { justify-content: space-between; }
}
</style>
