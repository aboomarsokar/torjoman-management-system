<script setup lang="ts">
/**
 * لوحة تحكّم الطالب — التبويبُ الأول في «صفحتي» وفي ملفّ الطالب عند العاملين: أرقامُه الأساسية في نظرةٍ واحدة
 * (طلبُ المستخدم 2026-10-20). `self` = الطالبُ نفسه (يقرأ بدوالّه الخاصّة، وبضمير المتكلّم)، وإلا العامل
 * (يقرأ بسياساته، وبضمير الغائب).
 * - التقدّم: «وصل N من 30 جزءاً» بثلاثين خانةً، وصفحاتُ الحفظ المعتمدة، والتقدّمُ الزمنيّ.
 * - الحضور هذا الشهر، والاختبارات (المجتاز وآخرُ نتيجة)، والمحطّةُ القادمة، وآخرُ شهرٍ معتمد.
 * - الحلقة: الاسم والمعلّم والموعد ومدّةُ الالتحاق.
 * الأرقامُ من `useStudentJourneyData` — المصدرُ نفسه لتبويب الرحلة، فلا يختلف رقمٌ بين التبويبين.
 */
import { EXAM_MAX_TOTAL } from '~/constants/exams'
import type { MyAttendance } from '~/composables/useMyAttendance'
import { cycleLabel } from '~/utils/exams/cycles'
import { sinceLabel } from '~/utils/journey'
import { periodLabel } from '~/utils/reportWindow'
// «10-2026» بعد كلامٍ عربيّ تنقلب «2026-10» — تُعزل لاتينيّاً
import { isolateLtr } from '~/utils/transport'

interface Props {
  studentId: string
  quranParts: number | null
  enrollmentDate: string | null
  attendance: MyAttendance | null
  halaqa: { name: string, teacher: string | null, time: string | null } | null
  /** الطالبُ نفسه (الافتراض) أم عاملٌ يفتح ملفّه. */
  self?: boolean
  /** جنسُ الطالب — لتسمية «المعلّم/المعلّمة». */
  gender?: string | null
}

const props = withDefaults(defineProps<Props>(), { self: true, gender: null })

const { targetPerMonth, months, memorizationPages, juzDone, journey } = useStudentJourneyData(() => ({
  studentId: props.studentId,
  quranParts: props.quranParts,
  ownRecords: props.self
}))

/** الصياغةُ بضمير المتكلّم للطالب وبالغائب للعامل. */
const t = computed(() => props.self
  ? { progress: 'تقدّمي في الحفظ', reachedLbl: 'جزءاً وصلتُ إليها', attendance: 'حضوري هذا الشهر', passed: 'دورة اجتزتها', notHeld: 'لم تنعقد حلقتك بعدُ هذا الشهر', halaqa: 'حلقتي' }
  : { progress: 'التقدّم في الحفظ', reachedLbl: 'جزءاً وصل إليها', attendance: 'الحضور هذا الشهر', passed: 'دورة اجتازها', notHeld: 'لم تنعقد الحلقة بعدُ هذا الشهر', halaqa: 'الحلقة' })
const teacherLabel = computed(() => (props.gender === 'female' ? 'المعلّمة' : 'المعلّم'))

// قبل تحميل مراجع الأجزاء يُعرض المثبتُ عند الالتحاق — لا صفرٌ يومض ثم يقفز
const reached = computed(() => juzDone.value ?? journey.value.parts)

const attendancePct = computed(() => {
  const a = props.attendance
  return a && a.held ? Math.round((a.attended / a.held) * 100) : null
})

// آخرُ محطّةٍ لها نتيجة (بترتيب الخطّة) — النجاحُ لا يُلغيه رسوبٌ لاحق، وهذا محسومٌ في buildJourney
const lastResult = computed(() => [...journey.value.stations].reverse().find(s => s.result) ?? null)

// أحدثُ شهرٍ معتمد
const lastMonth = computed(() => {
  const rows = months.value ?? []
  if (!rows.length) return null
  const top = rows.reduce((a, b) => (b.report_year * 12 + b.report_month > a.report_year * 12 + a.report_month ? b : a))
  const pages = rows
    .filter(r => r.report_year === top.report_year && r.report_month === top.report_month)
    .reduce((sum, r) => sum + (r.pages_memorized ?? 0), 0)
  return { label: isolateLtr(periodLabel(top.report_year, top.report_month)), pages }
})

// التقدّمُ الزمنيّ: الفعليّ مقابل (الأشهر منذ الالتحاق × المطلوب الشهري) — كما في StudentTimeProgress
const pace = computed(() => {
  const target = targetPerMonth.value ?? 0
  const actual = memorizationPages.value ?? 0
  // بلا صفحاتٍ معتمدةٍ بعدُ لا حكم (كما في StudentTimeProgress) — لا «متأخّر» لطالبٍ لم يُعتمد له شهر
  if (!props.enrollmentDate || target <= 0 || actual <= 0) return null
  const monthsIn = Math.max(1, (Date.now() - new Date(props.enrollmentDate).getTime()) / (30 * 24 * 3600 * 1000))
  const expected = Math.round(monthsIn * target)
  if (expected <= 0) return null
  const ratio = actual / expected
  const status = ratio >= 1.05 ? 'ahead' as const : ratio >= 0.85 ? 'onTrack' as const : 'behind' as const
  return { status, expected }
})
</script>

<template>
  <div class="dash">
    <StudentDashProgress
      :reached="reached"
      :memorization-pages="memorizationPages ?? 0"
      :quran-parts="quranParts"
      :pace="pace"
      :title="t.progress"
      :reached-label="t.reachedLbl"
    />

    <!-- الأرقام -->
    <div class="tiles">
      <section class="tile">
        <div class="t-head">
          <span class="t-ico green"><UIcon
            name="i-lucide-calendar-check"
            class="size-5"
          /></span>
          <span class="t-title">{{ t.attendance }}</span>
        </div>
        <template v-if="attendance && attendance.held">
          <div class="t-num">
            {{ attendance.attended }}<span class="t-of">/ {{ attendance.held }}</span>
          </div>
          <div class="meter">
            <span :style="{ width: `${attendancePct}%` }" />
          </div>
          <div class="t-sub">
            {{ attendancePct }}٪ · غاب {{ attendance.held - attendance.attended }} · {{ isolateLtr(attendance.label) }}
          </div>
        </template>
        <div
          v-else
          class="t-empty"
        >
          {{ t.notHeld }}<template v-if="attendance">
            ({{ isolateLtr(attendance.label) }})
          </template>
        </div>
      </section>

      <section class="tile">
        <div class="t-head">
          <span class="t-ico blue"><UIcon
            name="i-lucide-award"
            class="size-5"
          /></span>
          <span class="t-title">الاختبارات</span>
        </div>
        <div class="t-num">
          {{ journey.passedCount }}<span class="t-of">/ {{ journey.totalStations }}</span>
        </div>
        <div class="t-sub">
          {{ t.passed }}
        </div>
        <div
          v-if="lastResult"
          class="t-tag"
          :class="lastResult.result === 'passed' ? 'ok' : 'fail'"
        >
          آخرُ نتيجة: {{ lastResult.result === 'passed' ? 'نجح' : 'يعيد' }}<template v-if="lastResult.score != null">
            · {{ lastResult.score }}/{{ EXAM_MAX_TOTAL }}
          </template>
        </div>
      </section>

      <section class="tile">
        <div class="t-head">
          <span class="t-ico navy"><UIcon
            name="i-lucide-target"
            class="size-5"
          /></span>
          <span class="t-title">المحطّة القادمة</span>
        </div>
        <template v-if="journey.upcomingStation">
          <div class="t-big">
            الأجزاء {{ journey.upcomingStation.cycle.parts_from }}–{{ journey.upcomingStation.cycle.parts_to }}
          </div>
          <div class="t-sub">
            {{ cycleLabel(journey.upcomingStation.cycle) }}
          </div>
          <div
            v-if="journey.upcomingStation.reached"
            class="t-tag next"
          >
            مستحقّةٌ الآن
          </div>
        </template>
        <div
          v-else-if="journey.totalStations"
          class="t-big done"
        >
          أتمّ الخطّة 🎉
        </div>
        <div
          v-else
          class="t-empty"
        >
          لا دوراتِ اختبارٍ بعد.
        </div>
      </section>

      <section class="tile">
        <div class="t-head">
          <span class="t-ico green"><UIcon
            name="i-lucide-book-open-check"
            class="size-5"
          /></span>
          <span class="t-title">آخرُ شهرٍ معتمد</span>
        </div>
        <template v-if="lastMonth">
          <div class="t-num">
            {{ lastMonth.pages }}<span class="t-of">صفحة</span>
          </div>
          <div class="t-sub">
            شهر {{ lastMonth.label }}
          </div>
        </template>
        <div
          v-else
          class="t-empty"
        >
          لا شهورَ معتمدةً بعد.
        </div>
      </section>
    </div>

    <StudentReadingCard
      :student-id="studentId"
      :enrollment-date="enrollmentDate"
      :self="self"
    />

    <!-- حلقتي -->
    <section class="halaqa">
      <div class="hq-item">
        <span class="hq-lbl">{{ t.halaqa }}</span>
        <span class="hq-val">{{ halaqa?.name || 'بلا حلقة' }}</span>
      </div>
      <div
        v-if="halaqa?.teacher"
        class="hq-item"
      >
        <span class="hq-lbl">{{ teacherLabel }}</span>
        <span class="hq-val">{{ halaqa.teacher }}</span>
      </div>
      <div
        v-if="halaqa?.time"
        class="hq-item"
      >
        <span class="hq-lbl">الموعد</span>
        <span class="hq-val">{{ halaqa.time }}</span>
      </div>
      <div
        v-if="enrollmentDate"
        class="hq-item"
      >
        <span class="hq-lbl">منذ الالتحاق</span>
        <span class="hq-val">{{ sinceLabel(enrollmentDate) }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 18px; }

/* الأرقام */
.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.tile { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.t-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.t-ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.t-ico.green { background: var(--green-soft); color: var(--green-ink); }
.t-ico.blue { background: var(--blue-soft); color: var(--blue-ink); }
.t-ico.navy { background: var(--surface-3); color: var(--ink); }
.t-title { font-size: 14.5px; font-weight: 700; color: var(--ink); }
.t-num { font-size: 32px; font-weight: 800; color: var(--ink); line-height: 1.1; font-variant-numeric: tabular-nums; }
.t-of { font-size: 15px; font-weight: 600; color: var(--ink-3); margin-inline-start: 5px; }
.t-big { font-size: 19px; font-weight: 800; color: var(--ink); line-height: 1.35; }
.t-big.done { color: var(--green-ink); }
.t-sub { font-size: 13.5px; color: var(--ink-2); line-height: 1.6; }
.t-empty { font-size: 14px; color: var(--ink-3); line-height: 1.7; }
.t-tag { align-self: flex-start; margin-top: 6px; display: inline-flex; align-items: center; min-height: 26px; padding: 2px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.t-tag.ok { background: var(--green-soft); color: var(--green-ink); }
.t-tag.fail { background: var(--err-soft); color: var(--err); }
.t-tag.next { background: var(--blue-soft); color: var(--blue-ink); }
.meter { height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; margin: 4px 0 2px; }
.meter span { display: block; height: 100%; border-radius: 999px; background: var(--green); transition: width .4s ease; }

/* حلقتي */
.halaqa { display: flex; flex-wrap: wrap; background: var(--surface-2); border: 1px solid var(--line); border-radius: 18px; padding: 6px; }
.hq-item { flex: 1 1 160px; display: flex; flex-direction: column; gap: 4px; padding: 12px 16px; }
.hq-lbl { font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
.hq-val { font-size: 15.5px; font-weight: 700; color: var(--ink); text-align: start; }

@media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .tiles { gap: 12px; }
  .tile { padding: 16px; }
  .t-num { font-size: 28px; }
  .t-big { font-size: 16.5px; }
}
@media (max-width: 380px) { .tiles { grid-template-columns: 1fr; } }
</style>
