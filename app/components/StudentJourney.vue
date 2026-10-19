<script setup lang="ts">
/**
 * رحلة الطالب على خطة الاختبارات (حسب الحفظ) — مكوّن مشترك:
 * يُستخدم في ملف الطالب الداخلي والرابط العام.
 * يجمع: الأجزاء المثبتة + نتائج الاختبارات (نجح/يعيد بالدرجة) + إجمالي صفحات
 * الحفظ من التقارير المعتمدة + الزمن منذ الالتحاق.
 */
import { buildJourneyFromPlan, stageLabel, sinceLabel, type PlanInput, type ResultInput } from '~/utils/journey'

const props = defineProps<{
  quranParts: number | null
  plan: PlanInput[]
  results?: ResultInput[]
  memorizationPages?: number | null
  targetPerMonth?: number | null
  enrollmentDate?: string | null
}>()

const j = computed(() => buildJourneyFromPlan(props.quranParts, props.plan, props.results ?? []))
const pct = computed(() => Math.min(100, Math.round((j.value.parts / 30) * 100)))
</script>

<template>
  <div class="journey">
    <!-- ملخّص -->
    <div class="summary">
      <div class="metric">
        <div class="num">
          {{ j.parts }}<span class="unit">/30</span>
        </div>
        <div class="lbl">
          جزء مثبت
        </div>
      </div>
      <div class="metric">
        <div class="num">
          {{ j.passedCount }}<span class="unit">/{{ j.totalStations }}</span>
        </div>
        <div class="lbl">
          محطة اجتازها
        </div>
      </div>
      <div
        v-if="enrollmentDate"
        class="metric"
      >
        <div class="num small">
          {{ sinceLabel(enrollmentDate) }}
        </div>
        <div class="lbl">
          منذ الالتحاق
        </div>
      </div>
    </div>

    <div class="bar">
      <div
        class="bar-fill"
        :style="{ width: pct + '%' }"
      />
    </div>

    <div
      v-if="j.upcomingStation"
      class="next"
    >
      <UIcon
        name="i-lucide-target"
        class="size-4"
      />
      {{ j.upcomingStation.reached ? 'المحطة المستحقّة القادمة' : 'المحطة القادمة' }}: <strong>الأجزاء {{ j.upcomingStation.from }}–{{ j.upcomingStation.to }}</strong>
      <span class="muted">({{ stageLabel(j.upcomingStation.stage) }})</span>
    </div>
    <div
      v-else-if="j.totalStations"
      class="next done"
    >
      <UIcon
        name="i-lucide-party-popper"
        class="size-4"
      />
      اجتاز كل محطات الخطة 🎉
    </div>

    <StudentTimeProgress
      :enrollment-date="enrollmentDate"
      :memorization-pages="memorizationPages"
      :target-per-month="targetPerMonth"
    />

    <!-- المحطات -->
    <ul
      v-if="j.stations.length"
      class="stations"
    >
      <li
        v-for="(s, i) in j.stations"
        :key="i"
        class="station"
        :class="{ passed: s.result === 'passed', failed: s.result === 'failed', reached: s.reached && !s.result, next: s.isNext }"
      >
        <span class="dot">
          <UIcon
            v-if="s.result === 'passed'"
            name="i-lucide-check"
            class="size-[13px]"
          />
          <UIcon
            v-else-if="s.result === 'failed'"
            name="i-lucide-x"
            class="size-[13px]"
          />
        </span>
        <span class="range">الأجزاء {{ s.from }}–{{ s.to }}</span>
        <span class="stage">{{ stageLabel(s.stage) }}</span>
        <span class="status">
          <span
            v-if="s.result === 'passed'"
            class="tag tag-ok"
          >نجح<template v-if="s.score != null"> · {{ s.score }}/100</template></span>
          <span
            v-else-if="s.result === 'failed'"
            class="tag tag-fail"
          >يعيد<template v-if="s.score != null"> · {{ s.score }}/100</template></span>
          <span
            v-else-if="s.isNext"
            class="tag tag-next"
          >المستحقّة القادمة</span>
          <span
            v-else-if="s.reached"
            class="tag tag-eligible"
          >مستحقّ</span>
          <span
            v-else
            class="tag tag-soon"
          >لم تُبلغ</span>
        </span>
      </li>
    </ul>
    <p
      v-else
      class="empty"
    >
      لا توجد خطة اختبارات بعد.
    </p>

    <p class="hint">
      <UIcon
        name="i-lucide-info"
        class="size-[14px]"
      />
      «مستحقّ» = أتمّ حفظ نطاقها واستحقّ اختبارها · «نجح/يعيد» = نتيجة اختباره · صفحات الحفظ من التقارير الشهرية المعتمدة.
    </p>
  </div>
</template>

<style scoped>
.journey { display: flex; flex-direction: column; gap: 16px; }
.summary { display: flex; gap: 14px; flex-wrap: wrap; }
.metric { flex: 1; min-width: 120px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
.num { font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1; }
.num.small { font-size: 18px; }
.unit { font-size: 15px; color: var(--ink-3); font-weight: 600; }
.lbl { font-size: 13px; color: var(--ink-3); margin-top: 7px; }

.bar { height: 9px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; background: var(--green); transition: width .4s ease; }

.next { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 14.5px; color: var(--ink-2); }
.next strong { color: var(--ink); }
.next.done { color: var(--green-ink); font-weight: 600; }
.muted { color: var(--ink-3); }

.stations { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.station { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); position: relative; }
.station:last-child { border-bottom: none; }
.dot { width: 22px; height: 22px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--line-2); display: inline-flex; align-items: center; justify-content: center; color: #fff; flex: none; }
.station.passed .dot { background: var(--green); border-color: var(--green); }
.station.failed .dot { background: var(--err); border-color: var(--err); }
.station.reached .dot { background: var(--blue-soft); border-color: var(--blue); }
.station.next .dot { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.range { font-weight: 600; color: var(--ink); white-space: nowrap; }
.stage { font-size: 13px; color: var(--ink-3); }
.status { margin-inline-start: auto; }
.tag { display: inline-flex; align-items: center; height: 26px; padding: 0 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.tag-ok { background: var(--green-soft); color: var(--green-ink); }
.tag-fail { background: var(--err-soft); color: var(--err); }
.tag-next { background: var(--blue-soft); color: var(--blue-ink); }
.tag-eligible { background: var(--surface-3); color: var(--ink-2); }
.tag-soon { background: var(--surface-3); color: var(--ink-3); }

.empty { margin: 0; font-size: 14px; color: var(--ink-3); }
.hint { margin: 4px 0 0; display: flex; align-items: flex-start; gap: 7px; font-size: 12.5px; color: var(--ink-3); line-height: 1.7; }
</style>
