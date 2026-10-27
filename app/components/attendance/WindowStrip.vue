<script setup lang="ts">
/**
 * شريطُ آخر 15 يومَ دوام في شاشة حضور المعلّم (طلب المستخدم 2026-10-26 — نمطُ الصحابة): مربّعٌ لكلّ يومٍ برقمه ولونِ
 * حاله — مسجَّل · بانتظار الرفع · لم يُسجَّل · شهرٌ معتمَد — والضغطُ يفتح اليوم. الناقصُ أبرزُها لونًا، وحدُّ النافذة
 * يُقال دائماً كي لا يُقرأ «الكلُّ مسجَّل» على الشهر كلّه. والمربّعُ 44px يُضغط بالإبهام في الحلقة.
 */
import type { StripDay, StripState } from '~/utils/attendanceStrip'
import { formatDay } from '~/utils/reportWindow'

defineProps<{ days: StripDay[], missing: number, selected: string }>()
const emit = defineEmits<{ select: [day: string] }>()

const LABEL: Record<StripState, string> = {
  recorded: 'مسجَّل',
  queued: 'بانتظار الرفع',
  missing: 'لم يُسجَّل',
  locked: 'شهرٌ معتمَد'
}
</script>

<template>
  <div class="ws">
    <div class="ws-head">
      <p class="ws-sum">
        <template v-if="!missing">
          كلُّ أيام النافذة مسجَّلة
        </template>
        <template v-else>
          {{ missing }} من {{ days.length }} لم تُسجَّل
        </template>
      </p>
      <span class="ws-range">آخر {{ days.length }} يوم دوام</span>
    </div>
    <div
      class="ws-grid"
      role="list"
    >
      <button
        v-for="d in days"
        :key="d.date"
        type="button"
        role="listitem"
        class="ws-day"
        :class="[d.state, { sel: d.date === selected }]"
        :title="`${formatDay(d.date)} — ${LABEL[d.state]}`"
        :aria-label="`${formatDay(d.date)} — ${LABEL[d.state]}`"
        :aria-current="d.date === selected ? 'date' : undefined"
        @click="emit('select', d.date)"
      >
        {{ Number(d.date.slice(8)) }}
      </button>
    </div>
    <div class="ws-legend">
      <span><i class="missing" />لم يُسجَّل</span>
      <span><i class="recorded" />مسجَّل</span>
      <span><i class="queued" />بانتظار الرفع</span>
    </div>
  </div>
</template>

<style scoped>
.ws { display: flex; flex-direction: column; gap: 10px; }
.ws-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.ws-sum { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); }
.ws-range { font-size: 12.5px; color: var(--ink-3); }
.ws-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.ws-day { width: 44px; height: 44px; border-radius: 11px; border: 1.5px solid transparent; font: inherit; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; cursor: pointer; transition: transform .12s, box-shadow .12s; }
.ws-day:active { transform: scale(.95); }
.ws-day.recorded { background: var(--green-soft); border-color: color-mix(in srgb, var(--green) 55%, transparent); color: var(--green-ink); }
.ws-day.queued { background: var(--blue-soft); border-color: color-mix(in srgb, var(--blue) 55%, transparent); color: var(--blue-ink); }
.ws-day.missing { background: var(--chip-warn-bg); border-color: color-mix(in srgb, var(--chip-warn-ink) 45%, transparent); color: var(--chip-warn-ink); }
.ws-day.locked { background: var(--surface-2); border-color: var(--line); color: var(--ink-3); }
.ws-day.sel { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--navy); }
.ws-day:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.ws-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--ink-3); }
.ws-legend span { display: inline-flex; align-items: center; gap: 6px; }
.ws-legend i { width: 11px; height: 11px; border-radius: 3px; }
.ws-legend i.missing { background: var(--chip-warn-ink); opacity: .7; }
.ws-legend i.recorded { background: var(--green); }
.ws-legend i.queued { background: var(--blue); }
</style>
