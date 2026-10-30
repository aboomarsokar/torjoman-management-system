<script setup lang="ts">
/**
 * «متابعة الرصد» (طلب المستخدم 2026-10-22) — للمدير الإداري والمدير الفنيّ (اطّلاعاً) والمديرة الإدارية: أيُّ الحلقات
 * رصدت حضورها وأيُّها فاتها، وحالُ رصد الشهر القرآنيّ المستحقّ — لمعرفة المقصّر من المنجز بنظرة. لكلّ حلقة:
 * شبكةُ آخر 15 يومَ دوام (زرٌّ لكلّ يوم؛ الضغطُ يفتح حالَ اليوم تحت الحلقة: الحضورُ والغيابُ وأسماءُ الغائبين،
 * أو «فات بلا رصد» وزرٌّ إلى صفحة الحضور على ذلك اليوم)، وعددُ أيام الشهر المرصودة، وشارةُ الرصد الشهريّ،
 * والانتقالُ والتواصلُ مع المعلم. البياناتُ من `halaqat_recording_status` (طلبٌ واحد)، وتفصيلُ اليوم عند طلبه.
 * صفحتُه `/follow-up`: `page` يُخفي عنوانَه الداخليّ لأنّ رأسَ الصفحة يحمله.
 * الحلقاتُ سطورٌ مطويّة (طلب المستخدم 2026-10-22): أمامَ كلٍّ «رُصد X من Y»، والضغطُ يفتح تفاصيلَها. وفلترُ الشهر
 * (الجاري افتراضاً، وآخرُ ستة أشهر). «المعلّم/المعلّمة» بجنس الحلقة، والمخاطبةُ بجنس القارئ (والمشرفُ الميدانيّ حلقاتُه).
 */
import type { Database } from '~/types/database.types'
import { whatsappLink } from '~/utils/halaqatAchievement'
import type { DayState, RecordingRow, ReportState } from '~/utils/recordingStatus'
import { gazaToday, shiftMonth } from '~/utils/reportWindow'
import { isBeforeProjectStart } from '~/utils/projectStart'
import { daysLeft, isLagging, parseRecent, recordingSummary, reportState, sortByLag, weekdayName, weekdayShort } from '~/utils/recordingStatus'

/** في صفحته: رأسُ الصفحة يحمل العنوان. الغيابُ false (يُظهر العنوان). */
defineProps<{ page?: boolean }>()

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
// قسمُ المديرة الإدارية إناثٌ كلُّه: التسمياتُ بالمؤنّث
const { profile } = useProfile()
/** المخاطَبُ أنثى (المديرة الإدارية والمشرفة الميدانية): «افتحي» و«تواصلي». */
const fem = computed(() => profile.value?.gender === 'female')

// الشهر: الجاري افتراضاً (بلا معاملٍ في الدالّة)، وآخرُ ستة أشهر بالأرقام — لا قبل بداية المشروع
const MONTHS_BACK = 6
const nowMonth = (() => {
  const [y, m] = gazaToday().split('-').map(Number)
  return { year: y!, month: m! }
})()
const monthItems = Array.from({ length: MONTHS_BACK }, (_, i) => shiftMonth(nowMonth.year, nowMonth.month, -i))
  .filter((m, i) => i === 0 || !isBeforeProjectStart(m))
  .map((m, i) => ({ label: i === 0 ? `${m.month}/${m.year} — الجاري` : `${m.month}/${m.year}`, value: `${m.year}-${m.month}` }))
const monthKey = ref(monthItems[0]!.value)
const isCurrent = computed(() => monthKey.value === monthItems[0]!.value)

const { data, pending } = useLazyAsyncData<RecordingRow[]>(() => `halaqat-recording-status-${monthKey.value}`, async () => {
  const [y, m] = monthKey.value.split('-').map(Number)
  const { data: rows, error } = await supabase.rpc('halaqat_recording_status', isCurrent.value ? {} : { p_year: y, p_month: m })
  if (error) {
    handle(error)
    return []
  }
  return rows ?? []
}, { server: false, default: () => [], watch: [monthKey] })

const all = computed(() => sortByLag(data.value ?? []))
const summary = computed(() => recordingSummary(data.value ?? []))
const view = ref<'all' | 'lag'>('all')
const shown = computed(() => view.value === 'all' ? all.value : all.value.filter(isLagging))

// السطورُ مطويّةٌ افتراضاً
const expanded = ref(new Set<string>())
const isExpanded = (id: string) => expanded.value.has(id)
function toggleRow(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
/** نبرةُ العدد: كاملٌ أخضر، وما فاته يومٌ أحمر. */
const countTone = (r: RecordingRow) => r.missed_days.length ? 'bad' : r.recorded_days >= r.expected_days && r.expected_days > 0 ? 'ok' : ''
const filterOptions = computed(() => [
  { value: 'all' as const, label: `الكل (${summary.value.halqat})` },
  { value: 'lag' as const, label: `المقصّرة (${summary.value.lagging})` }
])

const DAY_META: Record<DayState, { icon: string | null, word: string }> = {
  held: { icon: 'i-lucide-check', word: 'مرصود' },
  missed: { icon: 'i-lucide-x', word: 'فات بلا رصد' },
  today: { icon: null, word: 'اليوم — لم يُرصد بعد' },
  before: { icon: null, word: 'قبل بدء الحلقة' },
  holiday: { icon: 'i-lucide-calendar-off', word: 'إجازة' },
  off: { icon: 'i-lucide-calendar-x', word: 'لم تنعقد — معتمَد' },
  off_pending: { icon: 'i-lucide-calendar-clock', word: 'لم تنعقد — بانتظار الاعتماد' }
}
const LEGEND: DayState[] = ['held', 'missed', 'today', 'before', 'holiday', 'off', 'off_pending']
/** شهرُ رابط «رصد الشهر»: المستحقّ، أو أوّلُ شهرٍ في المشروع إن وقع المستحقُّ قبله. */
const reportLinkMonth = (r: RecordingRow) => clampToProjectStart({ year: r.report_year, month: r.report_month })
const REPORT_META: Record<ReportState, { color: 'success' | 'info' | 'error' | 'warning', text: (r: RecordingRow) => string }> = {
  none: { color: 'info', text: () => '' },
  approved: { color: 'success', text: () => 'معتمَد' },
  submitted: { color: 'info', text: () => 'مُرسَل' },
  late: { color: 'error', text: r => r.report_status === 'draft' ? 'متأخّر — مسوّدة' : 'متأخّر — لم يبدأ' },
  due: { color: 'warning', text: (r) => {
    const n = daysLeft(r)
    return n === 0 ? 'مستحقٌّ اليوم' : `مستحقّ — بقي ${n} ${n === 1 ? 'يوم' : n === 2 ? 'يومان' : 'أيام'}`
  } }
}
const dayNum = (d: string) => Number(d.slice(8, 10))
const dayFull = (d: string) => `${weekdayName(d)} ${d.split('-').reverse().join('-')}`
/** «المعلّم/المعلّمة» بجنس الحلقة لا بالقارئ. */
const teacherWord = (r: { gender: string }) => r.gender === 'female' ? 'المعلّمة' : 'المعلّم'
/** تمييزُ العدد بعد «من»: الواحدةُ والاثنتان بلفظهما بلا رقم («حلقةٍ واحدة» · «حلقتين»)، ثم حلقات · حلقة. */
const halqatWord = (n: number) => n === 1 ? 'حلقةٍ واحدة' : n === 2 ? 'حلقتين' : n <= 10 ? 'حلقات' : 'حلقة'

// ── اليومُ المفتوح تحت حلقته (واحدٌ في الصفحة) ──
type Absentee = { name: string, kind: string }
type DayDetail = { roster: number, absentees: Absentee[] }
const open = ref<{ hid: string, day: string, state: DayState, female: boolean } | null>(null)
const detail = ref<DayDetail | null>(null)
const detailLoading = ref(false)
const cache = new Map<string, DayDetail>()

async function toggleDay(hid: string, day: string, state: DayState, female: boolean) {
  if (open.value?.hid === hid && open.value.day === day) {
    open.value = null
    return
  }
  open.value = { hid, day, state, female }
  detail.value = null
  if (state !== 'held') return
  const key = `${hid}|${day}`
  if (cache.has(key)) {
    detail.value = cache.get(key)!
    return
  }
  detailLoading.value = true
  // الحاضرون = النشطون الملتحقون حتى ذلك اليوم − الغائبين؛ والغيابُ بنوعه واسمِ صاحبه (RLS بنطاق الحلقة)
  const [{ data: abs, error: e1 }, { data: studs, error: e2 }] = await Promise.all([
    supabase.from('attendance_absences').select('kind, student:student_id(full_name)').eq('halaqa_id', hid).eq('day', day)
      .returns<{ kind: string, student: { full_name: string } | null }[]>(),
    supabase.from('students').select('id, enrollment_date').eq('halaqa_id', hid).eq('status', 'active')
  ])
  detailLoading.value = false
  if (e1 || e2) {
    handle(e1 ?? e2)
    return
  }
  const d: DayDetail = {
    roster: (studs ?? []).filter(s => !s.enrollment_date || s.enrollment_date <= day).length,
    absentees: (abs ?? []).map(a => ({ name: a.student?.full_name ?? '—', kind: a.kind }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }
  cache.set(key, d)
  if (open.value?.hid === hid && open.value.day === day) detail.value = d
}
const excused = computed(() => detail.value?.absentees.filter(a => a.kind === 'excused').length ?? 0)
const unexcused = computed(() => detail.value?.absentees.filter(a => a.kind !== 'excused').length ?? 0)
const present = computed(() => Math.max(0, (detail.value?.roster ?? 0) - (detail.value?.absentees.length ?? 0)))
</script>

<template>
  <section class="card rf">
    <div class="rf-head">
      <h3 v-if="!page">
        متابعة الرصد
      </h3>
      <div class="rf-filters">
        <UiSelect
          v-model="monthKey"
          :items="monthItems"
          size="lg"
          class="rf-month-sel"
          aria-label="الشهر"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
        />
        <UiFilterChips
          v-model="view"
          :options="filterOptions"
        />
      </div>
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
        <template v-if="isCurrent">
          اليوم رُصد حضورُ <b>{{ summary.today }}</b> من
        </template><template v-else>
          في هذا الشهر رصدت كلَّ أيامها <b>{{ summary.halqat - summary.lagging }}</b> من
        </template> <template v-if="summary.halqat > 2">
          <b>{{ summary.halqat }}</b>
        </template> {{ halqatWord(summary.halqat) }}
        <span class="dot">·</span>
        <b :class="{ bad: summary.lagging }">{{ summary.lagging }}</b> مقصّرة
        <span class="dot">·</span>
        رصدٌ شهريّ متأخّر في <b :class="{ bad: summary.lateReports }">{{ summary.lateReports }}</b>
      </p>
      <ul
        class="rf-legend"
        aria-label="دليل ألوان الأيام"
      >
        <li
          v-for="s in LEGEND"
          :key="s"
          :class="`s-${s}`"
        >
          <span class="rf-key" />{{ DAY_META[s].word }}
        </li>
      </ul>

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
          v-for="(r, i) in shown"
          :key="r.halaqa_id"
          class="rf-row"
          :class="{ open: isExpanded(r.halaqa_id) }"
        >
          <!-- السطرُ المطويّ: الاسمُ والمعلّم وعددُ أيام الشهر المرصودة؛ والضغطُ يفتح التفاصيل -->
          <button
            type="button"
            class="rf-sumrow"
            :aria-expanded="isExpanded(r.halaqa_id)"
            :aria-controls="`rf-body-${r.halaqa_id}`"
            @click="toggleRow(r.halaqa_id)"
          >
            <span class="rf-seq">{{ i + 1 }}</span>
            <span class="rf-who">
              <span class="rf-name">{{ r.halaqa_name }}</span>
              <span class="rf-teacher">{{ teacherWord(r) }}: {{ r.teacher_name ?? '—' }}</span>
            </span>
            <span
              class="rf-count"
              :class="countTone(r)"
            >
              <span class="rf-count-n">رُصد <b>{{ r.recorded_days }}</b> من <b>{{ r.expected_days }}</b></span>
              <span class="rf-count-s">{{ r.missed_days.length ? `فات ${r.missed_days.length}` : 'هذا الشهر' }}</span>
            </span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-5 rf-chev"
            />
          </button>

          <div
            v-show="isExpanded(r.halaqa_id)"
            :id="`rf-body-${r.halaqa_id}`"
            class="rf-body"
          >
            <div class="rf-top">
              <!-- لا شارةَ لشهرٍ قبل بداية المشروع (`none`) -->
              <UBadge
                v-if="reportState(r) !== 'none'"
                :label="`رصد ${r.report_month}/${r.report_year}: ${REPORT_META[reportState(r)].text(r)}`"
                :color="REPORT_META[reportState(r)].color"
                variant="soft"
              />
              <div class="rf-acts">
                <UButton
                  :to="`/attendance?h=${r.halaqa_id}`"
                  label="الحضور"
                  icon="i-lucide-calendar-check"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  class="rf-btn"
                  :ui="{ base: 'rounded-[9px]', leadingIcon: 'size-3' }"
                />
                <UButton
                  :to="`/reports?h=${r.halaqa_id}&y=${reportLinkMonth(r).year}&m=${reportLinkMonth(r).month}`"
                  label="رصد الشهر"
                  icon="i-lucide-book-marked"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  class="rf-btn"
                  :ui="{ base: 'rounded-[9px]', leadingIcon: 'size-3' }"
                />
                <UButton
                  v-if="whatsappLink(r.teacher_whatsapp || r.teacher_phone)"
                  :to="whatsappLink(r.teacher_whatsapp || r.teacher_phone)!"
                  target="_blank"
                  rel="noopener"
                  icon="i-simple-icons-whatsapp"
                  color="success"
                  variant="soft"
                  size="xs"
                  class="rf-btn"
                  :aria-label="`واتس أب ${teacherWord(r)} ${r.teacher_name ?? ''}`"
                  :ui="{ base: 'rounded-[9px] justify-center', leadingIcon: 'size-3.5' }"
                />
              </div>
            </div>

            <ol
              class="rf-days"
              :aria-label="`رصد الحضور في آخر أيام الدوام — ${r.halaqa_name}`"
            >
              <li
                v-for="d in parseRecent(r.recent)"
                :key="d.day"
              >
                <button
                  type="button"
                  class="rf-day"
                  :class="[`s-${d.state}`, { on: open?.hid === r.halaqa_id && open.day === d.day }]"
                  :aria-label="`${dayFull(d.day)}: ${DAY_META[d.state].word}`"
                  :aria-pressed="open?.hid === r.halaqa_id && open.day === d.day"
                  :aria-controls="`rf-day-${r.halaqa_id}`"
                  @click="toggleDay(r.halaqa_id, d.day, d.state, r.gender === 'female')"
                >
                  <span class="rf-dl">{{ weekdayShort(d.day) }}</span>
                  <span class="rf-dn">{{ dayNum(d.day) }}</span>
                  <UIcon
                    v-if="DAY_META[d.state].icon"
                    :name="DAY_META[d.state].icon!"
                    class="rf-di"
                  />
                </button>
              </li>
            </ol>

            <!-- حالُ اليوم المختار تحت حلقته — لا نافذة -->
            <div
              v-if="open?.hid === r.halaqa_id"
              :id="`rf-day-${r.halaqa_id}`"
              class="rf-detail"
              :class="`d-${open.state}`"
              role="region"
              :aria-label="`حال ${dayFull(open.day)}`"
            >
              <div class="rf-d-head">
                <b>{{ dayFull(open.day) }}</b>
                <span class="rf-d-state">{{ DAY_META[open.state].word }}</span>
                <button
                  type="button"
                  class="rf-d-close"
                  aria-label="إغلاق تفصيل اليوم"
                  @click="open = null"
                >
                  <UIcon
                    name="i-lucide-x"
                    class="size-4"
                  />
                </button>
              </div>

              <template v-if="open.state === 'held'">
                <UiSkeletonLines
                  v-if="detailLoading"
                  :fields="1"
                />
                <template v-else-if="detail">
                  <div class="rf-d-counts">
                    <span class="c-ok">حضور <b>{{ present }}</b></span>
                    <span class="c-ex">غياب بعذر <b>{{ excused }}</b></span>
                    <span class="c-un">غياب بلا عذر <b>{{ unexcused }}</b></span>
                  </div>
                  <ul
                    v-if="detail.absentees.length"
                    class="rf-d-list"
                  >
                    <li
                      v-for="a in detail.absentees"
                      :key="a.name"
                    >
                      <span>{{ a.name }}</span>
                      <UBadge
                        :label="a.kind === 'excused' ? 'بعذر' : 'بلا عذر'"
                        :color="a.kind === 'excused' ? 'info' : 'error'"
                        variant="soft"
                        size="sm"
                      />
                    </li>
                  </ul>
                  <p
                    v-else
                    class="rf-d-note"
                  >
                    {{ open.female ? 'حضرت الطالباتُ كلُّهنّ.' : 'حضر الطلابُ كلُّهم.' }}
                  </p>
                </template>
              </template>
              <!-- إجازةٌ أو بلاغ: السببُ يُقرأ عند الفتح -->
              <DashboardRecordingDayReason
                v-else-if="open.state === 'holiday' || open.state === 'off' || open.state === 'off_pending'"
                :state="open.state"
                :halaqa-id="r.halaqa_id"
                :day="open.day"
                :female="open.female"
              />
              <p
                v-else
                class="rf-d-note"
              >
                {{ open.state === 'missed'
                  ? `لم يُرصد حضورُ هذا اليوم — ${fem ? 'تواصلي' : 'تواصل'} مع ${open.female ? 'المعلّمة' : 'المعلّم'} أو ${fem ? 'افتحي' : 'افتح'} اليوم في صفحة الحضور.`
                  : open.state === 'today' ? 'اليومُ قائم ولم يُرصد بعد.' : 'قبل بدء الحلقة — لا رصدَ مطلوب.' }}
              </p>
              <UButton
                v-if="open.state !== 'before' && open.state !== 'holiday'"
                :to="`/attendance?h=${r.halaqa_id}&d=${open.day}`"
                :label="fem ? 'افتحي اليوم في صفحة الحضور' : 'افتح اليوم في صفحة الحضور'"
                icon="i-lucide-calendar-check"
                color="neutral"
                variant="outline"
                size="xs"
                class="rf-d-go rf-btn"
                :ui="{ base: 'rounded-[9px]', leadingIcon: 'size-3' }"
              />
            </div>
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
.rf-sum { margin: 0 0 8px; font-size: 14px; color: var(--ink-2); line-height: 1.9; }
.rf-sum b { color: var(--ink); font-variant-numeric: tabular-nums; }
.rf-sum b.bad { color: var(--err); }
.dot { margin: 0 6px; color: var(--ink-3); }
.rf-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; list-style: none; margin: 0 0 6px; padding: 0; font-size: 12.5px; color: var(--ink-2); }
.rf-legend li { display: inline-flex; align-items: center; gap: 6px; }
.rf-key { width: 12px; height: 12px; border-radius: 4px; }
.rf-legend .s-held .rf-key { background: var(--green); }
.rf-legend .s-missed .rf-key { background: var(--err); }
.rf-legend .s-today .rf-key { border: 1.5px dashed var(--ink-3); }
.rf-legend .s-before .rf-key { background: var(--surface-2); border: 1px solid var(--line); }
.rf-legend .s-holiday .rf-key { background: var(--surface-2); border: 1px solid var(--ink-3); }
.rf-legend .s-off .rf-key { background: var(--blue-soft); border: 1px solid var(--blue); }
.rf-legend .s-off_pending .rf-key { background: var(--chip-warn-bg); border: 1px solid var(--chip-warn-ink); }
.rf-clean { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; padding: 14px; border-radius: 13px; background: var(--green-soft); color: var(--green-ink); font-size: 14px; font-weight: 600; }

.rf-rows { list-style: none; margin: 0; padding: 0; }
.rf-filters { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; }
.rf-month-sel { width: 170px; }
.rf-row { border-top: 1px solid var(--line); }
.rf-sumrow { width: 100%; display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 10px 6px; background: none; border: 0; border-radius: 12px; font: inherit; color: inherit; text-align: start; cursor: pointer; }
.rf-sumrow:hover { background: var(--surface-2); }
.rf-sumrow:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.rf-sumrow .rf-who { flex: 1; }
/* الرقمُ المتسلسل كبطاقات العاملين والطلاب (2026-10-22) */
.rf-seq { min-width: 28px; height: 28px; padding: 0 7px; flex: none; border-radius: 999px; background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.rf-count { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; white-space: nowrap; }
.rf-count-n { font-size: 14px; color: var(--ink-2); }
.rf-count-n b { font-size: 17px; color: var(--ink); font-variant-numeric: tabular-nums; }
.rf-count-s { font-size: 12px; color: var(--ink-3); }
.rf-count.bad .rf-count-n b:first-child, .rf-count.bad .rf-count-s { color: var(--err); }
.rf-count.ok .rf-count-n b { color: var(--green-ink); }
.rf-chev { color: var(--ink-3); flex: none; transition: transform .18s ease-out; }
.rf-row.open .rf-chev { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .rf-chev { transition: none; } }
.rf-body { display: flex; flex-direction: column; gap: 10px; padding: 2px 6px 16px; }
.rf-top { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; }
.rf-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rf-name { font-size: 15.5px; font-weight: 600; color: var(--ink); }
.rf-teacher { font-size: 12.5px; color: var(--ink-3); overflow-wrap: anywhere; }
.rf-acts { display: flex; gap: 6px; flex-wrap: wrap; }
/* أزرارُ الانتقال مدمجة (طلب المستخدم 2026-10-22) — وعلى الجوال 36 كي يبقى اللمسُ مريحاً */
.rf-btn { min-height: 30px; padding-inline: 10px; font-size: 12.5px; gap: 5px; }
@media (max-width: 560px) { .rf-btn { min-height: 36px; } }

/* شبكةُ الأيام: 15 خانةً في سطرٍ على الواسع، وخمسٌ في السطر على الجوال */
.rf-days { display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 6px; list-style: none; margin: 0; padding: 0; }
.rf-day { position: relative; width: 100%; min-height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px 0; border-radius: 11px; border: 1px solid transparent; font: inherit; cursor: pointer; transition: transform .15s ease-out, box-shadow .15s ease-out; }
.rf-day:hover { transform: translateY(-1px); }
.rf-day:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.rf-day.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--navy); }
.rf-dl { font-size: 10.5px; line-height: 1; opacity: .85; }
.rf-dn { font-size: 15px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.rf-di { position: absolute; top: 4px; inset-inline-end: 4px; width: 11px; height: 11px; }
.s-held.rf-day { background: var(--green-soft); color: var(--green-ink); border-color: color-mix(in srgb, var(--green) 35%, transparent); }
.s-missed.rf-day { background: var(--err-soft); color: var(--err); border-color: color-mix(in srgb, var(--err) 30%, transparent); }
.s-today.rf-day { background: var(--surface); color: var(--ink); border: 1.5px dashed var(--ink-3); }
.s-before.rf-day { background: var(--surface-2); color: var(--ink-3); cursor: default; }
.s-before.rf-day:hover { transform: none; }
/* إجازةٌ عامة: هادئةٌ محايدة. لم تنعقد: أزرقُ المعتمَد، وعنبريُّ المعلّق (يُعدّ ناقصاً حتى يُعتمد) */
.s-holiday.rf-day { background: var(--surface-2); color: var(--ink-2); border-color: var(--line); }
.s-off.rf-day { background: var(--blue-soft); color: var(--blue-ink); border-color: color-mix(in srgb, var(--blue) 35%, transparent); }
.s-off_pending.rf-day { background: var(--chip-warn-bg); color: var(--chip-warn-ink); border-color: color-mix(in srgb, var(--chip-warn-ink) 35%, transparent); }
@media (prefers-reduced-motion: reduce) { .rf-day { transition: none; } .rf-day:hover { transform: none; } }

.rf-detail { padding: 12px 14px; border-radius: 13px; background: var(--surface-2); display: flex; flex-direction: column; gap: 10px; }
.rf-d-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rf-d-head b { font-size: 14.5px; color: var(--ink); }
.rf-d-state { font-size: 12.5px; font-weight: 600; padding: 2px 10px; border-radius: 999px; }
.d-held .rf-d-state { background: var(--green-soft); color: var(--green-ink); }
.d-missed .rf-d-state { background: var(--err-soft); color: var(--err); }
.d-today .rf-d-state, .d-before .rf-d-state, .d-holiday .rf-d-state { background: var(--surface); color: var(--ink-2); }
.d-off .rf-d-state { background: var(--blue-soft); color: var(--blue-ink); }
.d-off_pending .rf-d-state { background: var(--chip-warn-bg); color: var(--chip-warn-ink); }
.rf-d-close { margin-inline-start: auto; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 9px; background: none; color: var(--ink-3); cursor: pointer; }
.rf-d-close:hover { background: var(--surface); color: var(--ink); }
.rf-d-counts { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13.5px; color: var(--ink-2); }
.rf-d-counts b { font-variant-numeric: tabular-nums; font-size: 15px; }
.c-ok b { color: var(--green-ink); }
.c-ex b { color: var(--blue-ink); }
.c-un b { color: var(--err); }
.rf-d-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px 14px; }
.rf-d-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 34px; font-size: 14px; color: var(--ink); }
.rf-d-note { margin: 0; font-size: 13.5px; color: var(--ink-2); }
.rf-d-go { align-self: flex-start; }

@media (max-width: 760px) {
  .rf-days { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .rf-day { min-height: 56px; }
}
@media (max-width: 560px) {
  .rf { padding: 16px; }
}
</style>
