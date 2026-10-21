<script setup lang="ts">
/**
 * نموذجُ الزيارة الإشرافية (قرار المستخدم 2026-10-21): المعاييرُ الستّة ببنود خصمها، والمشرفُ يعدّ المرّات لكلّ بند
 * فتظهر محصّلةُ كلّ معيارٍ من 7 ومجموعُ الزيارة من 42 حيّاً. الحسابُ مرآةُ القاعدة (`utils/visitForm.ts`)،
 * والمحفوظُ تحسبه القاعدة نفسُها. `readOnly`: عرضٌ بلا عدّاد (الزيارةُ المقفلة، والإدارةُ، والمعلم).
 */
import type { Criterion, DeductionCounts } from '~/utils/visitForm'
import { CRITERION_MAX, DEDUCTION_COUNT_MAX, VISIT_MAX, criterionResult, visitTotals } from '~/utils/visitForm'

const props = defineProps<{ criteria: Criterion[], readOnly: boolean }>()
const counts = defineModel<DeductionCounts>('counts', { required: true })

const totals = computed(() => visitTotals(props.criteria, counts.value))
const results = computed(() => props.criteria.map(c => criterionResult(c, counts.value)))

function bump(key: string, by: number) {
  const n = Math.min(DEDUCTION_COUNT_MAX, Math.max(0, (counts.value[key] ?? 0) + by))
  counts.value = { ...counts.value, [key]: n }
}
</script>

<template>
  <div class="ef">
    <section
      v-for="(c, ci) in criteria"
      :key="c.number"
      class="ef-crit"
      :aria-labelledby="`ef-c${c.number}`"
    >
      <header class="ef-head">
        <span
          class="ef-num"
          aria-hidden="true"
        >{{ c.number }}</span>
        <div class="ef-title">
          <h4 :id="`ef-c${c.number}`">
            {{ c.label }}
          </h4>
          <span
            v-if="c.hint"
            class="ef-hint"
          >{{ c.hint }}</span>
        </div>
        <span
          class="ef-score"
          :class="{ low: results[ci]!.score < CRITERION_MAX }"
        ><b>{{ results[ci]!.score }}</b> / {{ CRITERION_MAX }}</span>
      </header>
      <ul class="ef-items">
        <li
          v-for="i in c.items"
          :key="i.key"
          class="ef-item"
          :class="{ hit: (counts[i.key] ?? 0) > 0 }"
        >
          <span class="ef-label">{{ i.label }}</span>
          <span class="ef-per">−{{ i.per_time }} للمرّة</span>
          <div
            v-if="!readOnly"
            class="ef-stepper"
            role="group"
            :aria-label="`عدد المرّات: ${i.label}`"
          >
            <UButton
              icon="i-lucide-minus"
              color="neutral"
              variant="outline"
              size="md"
              aria-label="أنقص مرّة"
              :disabled="!(counts[i.key] ?? 0)"
              :ui="{ base: 'rounded-[10px] min-w-10 min-h-10 justify-center' }"
              @click="bump(i.key, -1)"
            />
            <output class="ef-count">{{ counts[i.key] ?? 0 }}</output>
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="md"
              aria-label="زِد مرّة"
              :ui="{ base: 'rounded-[10px] min-w-10 min-h-10 justify-center' }"
              @click="bump(i.key, 1)"
            />
          </div>
          <span
            v-else
            class="ef-count ro"
          >{{ counts[i.key] ?? 0 }} مرّة</span>
          <span
            class="ef-sub"
            :class="{ zero: !(counts[i.key] ?? 0) }"
          >{{ (counts[i.key] ?? 0) ? `−${i.per_time * (counts[i.key] ?? 0)}` : '0' }}</span>
        </li>
      </ul>
    </section>

    <div class="ef-totals">
      <div>
        <span>الدرجة الكاملة</span>
        <b>{{ VISIT_MAX }}</b>
      </div>
      <div class="ded">
        <span>مجموع الخصم</span>
        <b>{{ totals.deducted ? `−${totals.deducted}` : '0' }}</b>
      </div>
      <div class="sum">
        <span>مجموع الزيارة</span>
        <b>{{ totals.score }} <small>/ {{ VISIT_MAX }}</small></b>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ef { display: flex; flex-direction: column; gap: 12px; }
.ef-crit { border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--surface); }
.ef-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
.ef-num { flex: none; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; border: 1.5px solid var(--navy); color: var(--navy); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ef-title { flex: 1; min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 10px; }
.ef-title h4 { margin: 0; font-size: 15.5px; font-weight: 700; color: var(--ink); }
.ef-hint { font-size: 12.5px; color: var(--ink-3); }
.ef-score { flex: none; padding: 3px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.ef-score b { font-size: 15px; color: var(--green-ink); }
.ef-score.low b { color: var(--err); }

.ef-items { list-style: none; margin: 0; padding: 0; }
.ef-item { display: grid; grid-template-columns: minmax(0, 1fr) auto auto 44px; align-items: center; gap: 10px; padding: 8px 14px; }
.ef-item + .ef-item { border-top: 1px solid var(--line); }
.ef-item.hit { background: color-mix(in oklab, var(--err-soft) 45%, transparent); }
.ef-label { font-size: 14px; color: var(--ink); line-height: 1.6; }
.ef-per { font-size: 12px; font-weight: 600; color: var(--err); background: var(--err-soft); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.ef-stepper { display: flex; align-items: center; gap: 6px; }
.ef-count { min-width: 28px; text-align: center; font-size: 16px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.ef-count.ro { min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--ink-2); white-space: nowrap; }
.ef-sub { text-align: end; font-size: 14px; font-weight: 700; color: var(--err); font-variant-numeric: tabular-nums; }
.ef-sub.zero { color: var(--ink-3); font-weight: 500; }

.ef-totals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.ef-totals > div { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); }
.ef-totals span { font-size: 12.5px; color: var(--ink-3); }
.ef-totals b { font-size: 22px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.ef-totals small { font-size: 13px; color: var(--ink-3); font-weight: 500; }
.ef-totals .ded { background: var(--err-soft); border-color: transparent; }
.ef-totals .ded b { color: var(--err); }
.ef-totals .sum { background: var(--blue-soft); border-color: var(--blue); }
.ef-totals .sum b { color: var(--blue-ink); }

@media (max-width: 560px) {
  .ef-item { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'label sub' 'per step'; row-gap: 6px; }
  .ef-label { grid-area: label; }
  .ef-sub { grid-area: sub; }
  .ef-per { grid-area: per; justify-self: start; }
  .ef-stepper, .ef-count.ro { grid-area: step; justify-self: end; }
  .ef-totals b { font-size: 19px; }
}
</style>
