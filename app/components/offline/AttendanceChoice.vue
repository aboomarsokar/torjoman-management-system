<script setup lang="ts">
/**
 * اختيارُ حال الطالب في حضور المعلّم بشكل تطبيق الصحابة (طلب المستخدم 2026-10-28 — الشكلُ وحده، والحالاتُ الثلاث كما
 * هي): «حاضر» زرٌّ كبيرٌ يمتلئ أخضرَ حين يُختار، و«غائب» بإطارٍ (= غائبٌ بلا عذر)، و«…» تحته «غائب بعذر» وحدها —
 * ومتى اختيرت صار الزرُّ «بعذر» ظاهراً. لا حالةَ «متأخر». لمسٌ ≥ 44px والوضعان من التوكنز.
 */
import type { AttendanceChoice } from '~/composables/useAttendanceDay'

const props = defineProps<{ modelValue: AttendanceChoice, name: string, disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [choice: AttendanceChoice] }>()

const pick = (c: AttendanceChoice) => {
  if (!props.disabled) emit('update:modelValue', c)
}
const moreItems = computed(() => [[{
  label: 'غائب بعذر',
  icon: 'i-lucide-file-check',
  type: 'checkbox' as const,
  checked: props.modelValue === 'excused',
  onSelect: () => pick('excused')
}]])
</script>

<template>
  <div
    class="ac"
    role="radiogroup"
    :aria-label="`حال ${name}`"
  >
    <button
      type="button"
      role="radio"
      class="b present"
      :class="{ on: modelValue === 'present' }"
      :aria-checked="modelValue === 'present'"
      :disabled="disabled"
      @click="pick('present')"
    >
      <UIcon
        name="i-lucide-check"
        class="size-5"
      />حاضر
    </button>
    <button
      type="button"
      role="radio"
      class="b absent"
      :class="{ on: modelValue === 'unexcused' }"
      :aria-checked="modelValue === 'unexcused'"
      :disabled="disabled"
      @click="pick('unexcused')"
    >
      غائب
    </button>
    <UDropdownMenu
      :items="moreItems"
      :disabled="disabled"
      :content="{ align: 'end' }"
    >
      <button
        type="button"
        class="b more"
        :class="{ on: modelValue === 'excused' }"
        :aria-label="modelValue === 'excused' ? `${name}: غائب بعذر — خيارات أخرى` : `خيارات أخرى لـ${name}`"
        :disabled="disabled"
      >
        <template v-if="modelValue === 'excused'">
          بعذر
        </template>
        <UIcon
          v-else
          name="i-lucide-ellipsis"
          class="size-5"
        />
      </button>
    </UDropdownMenu>
  </div>
</template>

<style scoped>
.ac { display: flex; align-items: stretch; gap: 8px; }
.b { min-height: 48px; min-width: 48px; padding: 0 16px; border-radius: 14px; border: 1.5px solid var(--line); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
.b:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.b:disabled { opacity: .55; cursor: not-allowed; }
.present { flex: 1 1 auto; min-width: 120px; }
.present.on { background: var(--green); border-color: var(--green); color: var(--on-primary); }
.absent.on { border-color: var(--err); background: var(--err-soft); color: var(--err); }
.more { padding: 0 12px; }
.more.on { border-color: var(--blue); background: var(--blue-soft); color: var(--blue-ink); }
@media (hover: hover) {
  .b:not(:disabled):not(.on):hover { background: var(--surface-2); }
}
</style>
