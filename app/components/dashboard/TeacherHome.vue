<script setup lang="ts">
/**
 * لوحة المعلم (طلبُ المستخدم 2026-10-20: «الأمور الهامة فقط بالأرقام») — تجيب عن سؤالين:
 * ما المطلوب منّي الآن؟ وكيف حالُ حلقتي؟ بالترتيب: ترويسةُ الحلقة ← «المطلوب منك الآن» ← أربعةُ أرقام
 * (حضورُ الشهر، وحفظُ آخر شهرٍ معتمد، والمستحقّون للاختبار، ونتائجُ اختبارات الشهر) ← «طلاب يحتاجون انتباهك».
 * قائمةُ كلّ الطلاب مكانُها شاشة «الطلاب». البياناتُ من `useTeacherDashboard` (خطوتا جلب).
 */
import { formatAmount, isolateLtr } from '~/utils/transport'
import { formatDay, gazaToday, periodLabel } from '~/utils/reportWindow'
import { teacherActions } from '~/utils/teacherDashboard'

// الشهورُ والتواريخ معزولةٌ لاتينيّاً: «10-2026» بعد كلامٍ عربيّ تنقلب «2026-10»
const day = (iso: string) => isolateLtr(formatDay(iso))

const { dash, pending } = useTeacherDashboard()

const d = computed(() => (dash.value && dash.value.halaqa ? dash.value : null))
const noHalaqa = computed(() => !pending.value && dash.value?.halaqa === null)
const monthLabel = computed(() => {
  const t = gazaToday()
  return isolateLtr(periodLabel(Number(t.slice(0, 4)), Number(t.slice(5, 7))))
})

const actions = computed(() => d.value
  ? teacherActions({
      today: gazaToday(),
      todayAttendance: d.value.today,
      recording: d.value.recording,
      recordedCount: d.value.recordedCount,
      studentCount: d.value.studentCount,
      incentive: d.value.incentive,
      newAlerts: d.value.newAlerts,
      money: (n: number) => isolateLtr(formatAmount(n)),
      day
    })
  : [])

const tiles = computed(() => {
  const v = d.value
  if (!v) return []
  return [
    { key: 'att', icon: 'i-lucide-calendar-check', tone: 'green', label: 'حضور الشهر', value: v.attendance.pct != null ? `${v.attendance.pct}٪` : '—', sub: v.attendance.held ? `${v.attendance.attended} من ${v.attendance.held} · ${monthLabel.value}` : `لم تنعقد الحلقة بعد · ${monthLabel.value}` },
    { key: 'pages', icon: 'i-lucide-book-open-check', tone: 'blue', label: 'حفظ آخر شهر معتمد', value: v.lastMonth ? `${v.lastMonth.pages}` : '—', unit: v.lastMonth ? 'صفحة' : '', sub: v.lastMonth ? `${v.lastMonth.perStudent} للطالب · ${isolateLtr(v.lastMonth.label)}` : 'لا شهر معتمد بعد' },
    { key: 'elig', icon: 'i-lucide-clipboard-check', tone: 'navy', label: 'مستحقّون للاختبار', value: String(v.eligible.length), sub: v.eligible.length ? 'أتمّوا نطاق دورتهم ولم يُرشَّحوا' : 'لا أحد ينتظر ترشيحاً' },
    { key: 'exams', icon: 'i-lucide-award', tone: 'green', label: 'اختبارات الشهر', value: String(v.exams.passed), unit: 'ناجح', sub: `${v.exams.failed} يعيد · ${monthLabel.value}` }
  ]
})

const showUnrecorded = computed(() => !!d.value && ['none', 'draft', 'returned'].includes(d.value.recording.state))
</script>

<template>
  <div class="th">
    <template v-if="pending && !d">
      <UiSkeletonBand :actions="0" />
      <UiSkeletonLines :fields="4" />
    </template>

    <div
      v-else-if="noHalaqa"
      class="card placeholder"
    >
      لا توجد حلقة معيّنة لك بعد. تواصل مع الإدارة لإسناد حلقتك.
    </div>

    <template v-else-if="d">
      <!-- ترويسة الحلقة -->
      <div class="card head">
        <span class="h-ico"><UIcon
          name="i-lucide-book-open"
          class="size-6"
        /></span>
        <div class="h-info">
          <h2>{{ d.halaqa.name }}</h2>
          <p>
            {{ d.studentCount }} طالب<template v-if="d.halaqa.daily_time">
              · الموعد <span dir="ltr">{{ d.halaqa.daily_time.slice(0, 5) }}</span>
            </template>
          </p>
        </div>
      </div>

      <DashboardTeacherActions :actions="actions" />

      <!-- أرقام الحلقة -->
      <div class="tiles">
        <section
          v-for="t in tiles"
          :key="t.key"
          class="tile"
        >
          <div class="t-head">
            <span
              class="t-ico"
              :class="t.tone"
            ><UIcon
              :name="t.icon"
              class="size-5"
            /></span>
            <span class="t-label">{{ t.label }}</span>
          </div>
          <div class="t-num">
            {{ t.value }}<span
              v-if="t.unit"
              class="t-unit"
            >{{ t.unit }}</span>
          </div>
          <div class="t-sub">
            {{ t.sub }}
          </div>
        </section>
      </div>

      <DashboardTeacherAttention
        :absentees="d.absentees"
        :unrecorded="d.unrecorded"
        :show-unrecorded="showUnrecorded"
        :recording-label="d.recording.label"
        :eligible="d.eligible"
        :reading-behind="d.readingBehind"
      />
    </template>
  </div>
</template>

<style scoped>
.th { display: flex; flex-direction: column; gap: 18px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; }
.placeholder { font-size: 15px; color: var(--ink-2); }
.head { display: flex; align-items: center; gap: 14px; }
.h-ico { width: 48px; height: 48px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.h-info { min-width: 0; }
.h-info h2 { margin: 0; font-size: 19px; font-weight: 700; color: var(--ink); line-height: 1.4; }
.h-info p { margin: 4px 0 0; font-size: 14px; color: var(--ink-2); }

.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.tile { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.t-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.t-ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.t-ico.green { background: var(--green-soft); color: var(--green-ink); }
.t-ico.blue { background: var(--blue-soft); color: var(--blue-ink); }
.t-ico.navy { background: var(--surface-3); color: var(--ink); }
.t-label { font-size: 14px; font-weight: 700; color: var(--ink); }
.t-num { font-size: 32px; font-weight: 800; color: var(--ink); line-height: 1.1; font-variant-numeric: tabular-nums; }
.t-unit { font-size: 15px; font-weight: 600; color: var(--ink-3); margin-inline-start: 6px; }
.t-sub { font-size: 13px; color: var(--ink-2); line-height: 1.6; }

@media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) {
  .th { gap: 14px; }
  .card { padding: 16px; }
  .tiles { gap: 12px; }
  .tile { padding: 14px; }
  .t-num { font-size: 26px; }
}
</style>
