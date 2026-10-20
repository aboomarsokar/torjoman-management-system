<script setup lang="ts">
/**
 * بطاقةُ «التقدّم في الحفظ» في لوحة الطالب — «وصل N من 30 جزءاً» بثلاثين خانة، وشارةُ التقدّم الزمنيّ
 * (متقدّم / في المسار / متأخّر)، وصفحاتُ الحفظ المعتمدة والمتوقّعُ والمثبتُ عند الالتحاق.
 * الأرقامُ تُحسب في `StudentDashboard` (من `useStudentJourneyData`) وتصل جاهزة.
 */
import { PROGRAM_JUZ_COUNT } from '~/constants/quran'

interface Props {
  /** أجزاءُ البرنامج التي وصل إليها. */
  reached: number
  memorizationPages: number
  quranParts: number | null
  /** التقدّمُ الزمنيّ، أو null حين لا حكم (لا صفحاتٍ معتمدة أو لا تاريخ التحاق). */
  pace: { status: 'ahead' | 'onTrack' | 'behind', expected: number } | null
  /** العنوانُ وتسميةُ الرقم بضمير القارئ («تقدّمي / التقدّم»). */
  title: string
  reachedLabel: string
}

const props = defineProps<Props>()

const cells = computed(() => Array.from({ length: PROGRAM_JUZ_COUNT }, (_, i) => i < props.reached))
const PACE = {
  ahead: { label: 'متقدّم على خطّته', icon: 'i-lucide-trending-up' },
  onTrack: { label: 'في المسار', icon: 'i-lucide-check' },
  behind: { label: 'متأخّر عن خطّته', icon: 'i-lucide-trending-down' }
} as const
</script>

<template>
  <section
    class="hero"
    :aria-label="title"
  >
    <div class="hero-head">
      <div>
        <div class="eyebrow">
          {{ title }}
        </div>
        <div class="hero-num">
          {{ reached }}<span class="hero-of">/ {{ PROGRAM_JUZ_COUNT }}</span>
        </div>
        <div class="hero-lbl">
          {{ reachedLabel }}
        </div>
      </div>
      <div
        v-if="pace"
        class="pace"
        :class="pace.status"
      >
        <UIcon
          :name="PACE[pace.status].icon"
          class="size-4"
        />
        {{ PACE[pace.status].label }}
      </div>
    </div>

    <div
      class="juz"
      role="img"
      :aria-label="`وصل ${reached} من ${PROGRAM_JUZ_COUNT} جزءاً`"
    >
      <span
        v-for="(on, i) in cells"
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
</template>

<style scoped>
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

@media (max-width: 640px) {
  .hero { padding: 20px 18px; }
  .hero-num { font-size: 44px; }
  .juz { grid-template-columns: repeat(15, 1fr); }
  .cell { height: 18px; }
}
</style>
