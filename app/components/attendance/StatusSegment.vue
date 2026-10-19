<script setup lang="ts">
/**
 * مقطعٌ ثلاثيّ لحالة الطالب في اليوم: حاضر · غائب بعذر · غائب بلا عذر.
 * v-model هو الحالة المختارة؛ كلُّ زرٍّ لا يقلّ عن 44px، والألوان من توكنز الهوية.
 */
import type { AttendanceChoice } from '~/composables/useAttendanceDay'

defineProps<{ disabled?: boolean, name: string }>()
const model = defineModel<AttendanceChoice>({ required: true })

const OPTIONS: { value: AttendanceChoice, label: string }[] = [
  { value: 'present', label: 'حاضر' },
  { value: 'excused', label: 'غائب بعذر' },
  { value: 'unexcused', label: 'غائب بلا عذر' }
]
</script>

<template>
  <div
    class="seg"
    role="radiogroup"
    :aria-label="`حالة ${name}`"
  >
    <button
      v-for="o in OPTIONS"
      :key="o.value"
      type="button"
      role="radio"
      class="seg-btn"
      :class="[`k-${o.value}`, { on: model === o.value }]"
      :aria-checked="model === o.value"
      :disabled="disabled"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.seg { display: inline-flex; gap: 4px; padding: 4px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 15px; }
.seg-btn { min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: 11px; border: 1px solid transparent; background: transparent; color: var(--ink-2); font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background-color .15s var(--ease-out), color .15s var(--ease-out); }
.seg-btn:disabled { cursor: not-allowed; opacity: .6; }
.seg-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.seg-btn.on.k-present { background: var(--green-soft); color: var(--green-ink); border-color: var(--green); }
.seg-btn.on.k-excused { background: var(--blue-soft); color: var(--blue-ink); border-color: var(--blue); }
.seg-btn.on.k-unexcused { background: var(--err-soft); color: var(--err); border-color: var(--err); }

@media (max-width: 520px) { .seg { display: flex; width: 100%; } .seg-btn { flex: 1; padding: 0 6px; font-size: 13px; } }
</style>
