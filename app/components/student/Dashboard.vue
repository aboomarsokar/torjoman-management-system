<script setup lang="ts">
/**
 * لوحة تحكّم الطالب — التبويبُ الأول في «صفحتي»: أرقامُه الأساسية في نظرةٍ واحدة (طلبُ المستخدم 2026-10-20).
 * - التقدّم: «وصل N من 30 جزءاً» بثلاثين خانةً، وصفحاتُ الحفظ المعتمدة، والتقدّمُ الزمنيّ.
 * - الحضور هذا الشهر، والاختبارات (المجتاز وآخرُ نتيجة)، والمحطّةُ القادمة، وآخرُ شهرٍ معتمد.
 * - حلقتي: الاسم والمعلّم والموعد ومدّةُ الالتحاق.
 * الأرقامُ من `useStudentJourneyData` — المصدرُ نفسه لتبويب «رحلتي»، فلا يختلف رقمٌ بين التبويبين.
 */
import { PROGRAM_JUZ_COUNT } from '~/constants/quran'
import { EXAM_MAX_TOTAL } from '~/constants/exams'
import type { MyAttendance } from '~/composables/useMyAttendance'
import { cycleLabel } from '~/utils/exams/cycles'
import { sinceLabel } from '~/utils/journey'
import { periodLabel } from '~/utils/reportWindow'

interface Props {
  studentId: string
  quranParts: number | null
  enrollmentDate: string | null
  attendance: MyAttendance | null
  halaqa: { name: string, teacher: string | null, time: string | null } | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ open: ['journey' | 'data'] }>()

const { targetPerMonth, months, memorizationPages, juzDone, journey } = useStudentJourneyData(() => ({
  studentId: props.studentId,
  quranParts: props.quranParts,
  ownRecords: true
}))

// قبل تحميل مراجع الأجزاء يُعرض المثبتُ عند الالتحاق — لا صفرٌ يومض ثم يقفز
const reached = computed(() => juzDone.value ?? journey.value.parts)
const juzCells = computed(() => Array.from({ length: PROGRAM_JUZ_COUNT }, (_, i) => i < reached.value))

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
  return { label: periodLabel(top.report_year, top.report_month), pages }
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
  const status = ratio >= 1.05 ? 'ahead' : ratio >= 0.85 ? 'onTrack' : 'behind'
  return { status, expected }
})
const PACE: Record<string, { label: string, icon: string }> = {
  ahead: { label: 'متقدّم على خطّته', icon: 'i-lucide-trending-up' },
  onTrack: { label: 'في المسار', icon: 'i-lucide-check' },
  behind: { label: 'متأخّر عن خطّته', icon: 'i-lucide-trending-down' }
}
</script>

<template>
  <div class="dash">
    <!-- التقدّم في الحفظ -->
    <section
      class="hero"
      aria-label="تقدّمي في الحفظ"
    >
      <div class="hero-head">
        <div>
          <div class="eyebrow">
            تقدّمي في الحفظ
          </div>
          <div class="hero-num">
            {{ reached }}<span class="hero-of">/ {{ PROGRAM_JUZ_COUNT }}</span>
          </div>
          <div class="hero-lbl">
            جزءاً وصلتُ إليها
          </div>
        </div>
        <div
          v-if="pace"
          class="pace"
          :class="pace.status"
        >
          <UIcon
            :name="PACE[pace.status]!.icon"
            class="size-4"
          />
          {{ PACE[pace.status]!.label }}
        </div>
      </div>

      <div
        class="juz"
        role="img"
        :aria-label="`وصل ${reached} من ${PROGRAM_JUZ_COUNT} جزءاً`"
      >
        <span
          v-for="(on, i) in juzCells"
          :key="i"
          class="cell"
          :class="{ on }"
        />
      </div>

      <div class="hero-foot">
        <span><strong>{{ memorizationPages }}</strong> صفحة حفظٍ معتمدة</span>
        <span v-if="pace">المتوقّع حتى الآن ~{{ pace.expected }} صفحة</span>
        <span v-if="quranParts">مثبتٌ عند الالتحاق: {{ quranParts }} جزء</span>
      </div>
    </section>

    <!-- الأرقام -->
    <div class="tiles">
      <section class="tile">
        <div class="t-head">
          <span class="t-ico green"><UIcon
            name="i-lucide-calendar-check"
            class="size-5"
          /></span>
          <span class="t-title">حضوري هذا الشهر</span>
        </div>
        <template v-if="attendance && attendance.held">
          <div class="t-num">
            {{ attendance.attended }}<span class="t-of">/ {{ attendance.held }}</span>
          </div>
          <div class="meter">
            <span :style="{ width: `${attendancePct}%` }" />
          </div>
          <div class="t-sub">
            {{ attendancePct }}٪ · غاب {{ attendance.held - attendance.attended }} · {{ attendance.label }}
          </div>
        </template>
        <div
          v-else
          class="t-empty"
        >
          لم تنعقد حلقتك بعدُ هذا الشهر<template v-if="attendance">
            ({{ attendance.label }})
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
          دورة اجتزتها
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

    <!-- حلقتي -->
    <section class="halaqa">
      <div class="hq-item">
        <span class="hq-lbl">حلقتي</span>
        <span class="hq-val">{{ halaqa?.name || 'بلا حلقة' }}</span>
      </div>
      <div
        v-if="halaqa?.teacher"
        class="hq-item"
      >
        <span class="hq-lbl">المعلّم</span>
        <span class="hq-val">{{ halaqa.teacher }}</span>
      </div>
      <div
        v-if="halaqa?.time"
        class="hq-item"
      >
        <span class="hq-lbl">الموعد</span>
        <span
          class="hq-val"
          dir="ltr"
        >{{ halaqa.time }}</span>
      </div>
      <div
        v-if="enrollmentDate"
        class="hq-item"
      >
        <span class="hq-lbl">منذ الالتحاق</span>
        <span class="hq-val">{{ sinceLabel(enrollmentDate) }}</span>
      </div>
    </section>

    <div class="more">
      <button
        type="button"
        class="more-btn"
        @click="emit('open', 'journey')"
      >
        رحلتي وسجلّ الشهور
        <UIcon
          name="i-lucide-arrow-left"
          class="size-4"
        />
      </button>
      <button
        type="button"
        class="more-btn"
        @click="emit('open', 'data')"
      >
        بياناتي
        <UIcon
          name="i-lucide-arrow-left"
          class="size-4"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 18px; }

/* التقدّم */
.hero { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow); padding: 24px 26px; }
.hero-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.eyebrow { font-size: 13.5px; font-weight: 600; color: var(--ink-3); }
.hero-num { font-size: 52px; font-weight: 800; line-height: 1.05; color: var(--ink); margin-top: 6px; font-variant-numeric: tabular-nums; }
.hero-of { font-size: 22px; font-weight: 600; color: var(--ink-3); margin-inline-start: 6px; }
.hero-lbl { font-size: 14.5px; color: var(--ink-2); margin-top: 2px; }
.pace { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px; border-radius: 999px; font-size: 13.5px; font-weight: 700; }
.pace.ahead { background: var(--green-soft); color: var(--green-ink); }
.pace.onTrack { background: var(--blue-soft); color: var(--blue-ink); }
.pace.behind { background: var(--err-soft); color: var(--err); }

.juz { display: grid; grid-template-columns: repeat(30, 1fr); gap: 4px; margin: 20px 0 16px; }
.cell { height: 22px; border-radius: 5px; background: var(--surface-3); border: 1px solid var(--line); }
.cell.on { background: var(--green); border-color: var(--green); }
.hero-foot { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 14px; color: var(--ink-2); }
.hero-foot strong { color: var(--ink); font-size: 16px; }

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

.more { display: flex; gap: 10px; flex-wrap: wrap; }
.more-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.more-btn:hover { background: var(--surface-2); color: var(--ink); }

@media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .hero { padding: 20px 18px; }
  .hero-num { font-size: 44px; }
  .juz { grid-template-columns: repeat(15, 1fr); gap: 4px; }
  .cell { height: 18px; }
  .tiles { gap: 12px; }
  .tile { padding: 16px; }
  .t-num { font-size: 28px; }
  .t-big { font-size: 16.5px; }
}
@media (max-width: 380px) { .tiles { grid-template-columns: 1fr; } }
</style>
