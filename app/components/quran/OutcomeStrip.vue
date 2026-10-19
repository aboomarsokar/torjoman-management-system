<script setup lang="ts">
/**
 * شريطُ حكم الشهر فوق بطاقات الطلاب: نسبةُ المرصودين بشريطٍ أخضر («اكتمل رصد <الحلقة>» عند 100%)،
 * وعدّاداتٌ أربعة (أنجز · مقصّر · لا يُقاس · لم يُرصد). الضغطُ على عدّادٍ يُرشّح البطاقات وضغطُه ثانيةً يرفع
 * الترشيح؛ والعدّادُ الفارغ باهتٌ لا يُضغط (ترشيحٌ يُفرغ الكشف يُقرأ ضياعاً).
 */
import type { Outcome } from '~/utils/quran/plan'
import { OUTCOME_LABELS } from '~/utils/quran/plan'
import { OUTCOME_COLORS, OUTCOME_ORDER } from '~/utils/quran/screen'

const props = defineProps<{
  summary: Record<Outcome, number> & { recordedPct: number }
  /** عددُ الطلاب كلّهم. */
  total: number
  halaqaName: string
}>()
const filter = defineModel<Outcome | null>({ default: null })

const recorded = computed(() => props.total - props.summary.unrecorded)
const title = computed(() => props.summary.recordedPct === 100
  ? `اكتمل رصد ${props.halaqaName}`
  : `رُصد ${recorded.value} من ${props.total} في ${props.halaqaName}`)

function toggle(outcome: Outcome) {
  filter.value = filter.value === outcome ? null : outcome
}
</script>

<template>
  <section
    class="strip"
    aria-label="حكم الشهر"
  >
    <div class="meter">
      <div class="meter-head">
        <strong>{{ title }}</strong>
        <span class="pct">{{ summary.recordedPct }}%</span>
      </div>
      <UProgress
        :model-value="summary.recordedPct"
        color="success"
        size="md"
        :aria-label="title"
      />
    </div>
    <div
      class="counters"
      role="group"
      aria-label="ترشيح بالنتيجة"
    >
      <UButton
        v-for="o in OUTCOME_ORDER"
        :key="o"
        :color="OUTCOME_COLORS[o]"
        :variant="filter === o ? 'solid' : 'soft'"
        size="lg"
        class="counter"
        :disabled="summary[o] === 0 && filter !== o"
        :aria-pressed="filter === o"
        :ui="{ base: 'rounded-[13px]' }"
        @click="toggle(o)"
      >
        <span class="num">{{ summary[o] }}</span>
        <span>{{ OUTCOME_LABELS[o] }}</span>
      </UButton>
    </div>
  </section>
</template>

<style scoped>
.strip { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.meter { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-card); padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
.meter-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--ink); font-size: 16px; }
.pct { color: var(--ink-2); font-variant-numeric: tabular-nums; font-size: 14px; }
.counters { display: flex; flex-wrap: wrap; gap: 8px; }
.counter { min-height: 44px; gap: 8px; }
.num { font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
