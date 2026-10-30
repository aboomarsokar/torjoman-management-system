<script setup lang="ts">
/**
 * ملخّصُ خطة القسم في سطرٍ واحد (تحسين 2026-10-30): شريطُ إنجاز الخطة كلّها، وشاراتٌ بما يحتاج انتباهاً
 * (قيد التنفيذ · خلال يومين · متأخّرة). الشارتان الأخيرتان تصفّيان الأنشطة بالضغط عليهما.
 */
import type { TaskFilter } from '~/utils/deptPlan'

interface Props { done: number, total: number, pct: number, active: number, soon: number, late: number }
defineProps<Props>()
const emit = defineEmits<{ filter: [f: TaskFilter] }>()
</script>

<template>
  <section
    class="ps"
    aria-label="ملخص الخطة"
  >
    <div class="ps-progress">
      <div class="ps-top">
        <span class="ps-pct"><b dir="ltr">{{ pct }}%</b> إنجاز الخطة</span>
        <span class="ps-frac">{{ done }} من {{ total }} نشاطاً منجزاً</span>
      </div>
      <div
        class="ps-track"
        role="progressbar"
        :aria-valuenow="pct"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="نسبة إنجاز الخطة"
      >
        <i :style="{ transform: `scaleX(${pct / 100})` }" />
      </div>
    </div>
    <div class="ps-chips">
      <span class="ps-chip">
        <UIcon
          name="i-lucide-loader"
          class="size-4"
        />
        قيد التنفيذ <b>{{ active }}</b>
      </span>
      <button
        type="button"
        class="ps-chip is-soon"
        :class="{ on: soon > 0 }"
        @click="emit('filter', 'soon')"
      >
        <UIcon
          name="i-lucide-alarm-clock"
          class="size-4"
        />
        خلال يومين <b>{{ soon }}</b>
      </button>
      <button
        type="button"
        class="ps-chip is-late"
        :class="{ on: late > 0 }"
        @click="emit('filter', 'overdue')"
      >
        <UIcon
          name="i-lucide-clock-alert"
          class="size-4"
        />
        متأخّرة <b>{{ late }}</b>
      </button>
    </div>
  </section>
</template>

<style scoped>
.ps {
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px 28px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 16px 20px;
}
.ps-progress { flex: 1 1 320px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.ps-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ps-pct { display: inline-flex; align-items: baseline; gap: 8px; font-weight: 600; color: var(--ink-2); font-size: 14px; }
.ps-pct b { font-size: 26px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1; }
.ps-frac { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.ps-track { height: 10px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.ps-track i { display: block; height: 100%; border-radius: 999px; background: var(--green); transform-origin: right; transition: transform .4s var(--ease-out); }
.ps-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ps-chip {
  display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px;
  border-radius: 12px; background: var(--surface-3); color: var(--ink-2); font: inherit; font-size: 14px; font-weight: 600; border: 0;
}
.ps-chip b { font-variant-numeric: tabular-nums; color: var(--ink); }
button.ps-chip { cursor: pointer; transition: background-color .15s var(--ease-out); }
button.ps-chip:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.ps-chip.is-soon.on { background: var(--chip-warn-bg); color: var(--chip-warn-ink); }
.ps-chip.is-soon.on b { color: var(--chip-warn-ink); }
.ps-chip.is-late.on { background: var(--err-soft); color: var(--err); }
.ps-chip.is-late.on b { color: var(--err); }
@media (hover: hover) {
  button.ps-chip:hover { filter: brightness(.97); }
}
@media (prefers-reduced-motion: reduce) {
  .ps-track i, button.ps-chip { transition: none; }
}
</style>
