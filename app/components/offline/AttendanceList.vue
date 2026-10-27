<script setup lang="ts">
/**
 * قائمةُ طلاب اليوم في شاشة حضور المعلّم بلا إنترنت: ملخّصُ اليوم، ثمّ لكلّ طالبٍ اسمُه ومقطعُ حاله
 * (حاضر · غائب بعذر · غائب بلا عذر). المسوّدةُ عند الأب، وهنا العرضُ والاختيار.
 */
import type { AttendanceChoice, DaySummary } from '~/composables/useAttendanceDay'
import type { MirrorStudent } from '~/composables/useOfflineMirror'
import type { Absences } from '~/utils/attendanceOutbox'

defineProps<{ students: MirrorStudent[], draft: Absences, summary: DaySummary, disabled: boolean }>()
const emit = defineEmits<{ set: [studentId: string, choice: AttendanceChoice] }>()
</script>

<template>
  <section class="al">
    <div
      class="al-sum"
      aria-live="polite"
    >
      <span class="p"><b>{{ summary.present }}</b> حاضر</span>
      <span class="e"><b>{{ summary.excused }}</b> بعذر</span>
      <span class="u"><b>{{ summary.unexcused }}</b> بلا عذر</span>
    </div>
    <ul>
      <li
        v-for="(s, i) in students"
        :key="s.id"
      >
        <span class="name"><i>{{ i + 1 }}</i>{{ s.full_name }}</span>
        <AttendanceStatusSegment
          :model-value="draft[s.id] ?? 'present'"
          :name="s.full_name"
          :disabled="disabled"
          @update:model-value="emit('set', s.id, $event)"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.al { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
.al-sum { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--line); }
.al-sum span { display: flex; flex-direction: column; align-items: center; padding: 12px 6px; font-size: 13px; font-weight: 500; color: var(--ink-3); }
.al-sum span + span { border-inline-start: 1px solid var(--line); }
.al-sum b { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.al-sum .p b { color: var(--green-ink); }
.al-sum .e b { color: var(--blue-ink); }
.al-sum .u b { color: var(--err); }
ul { list-style: none; margin: 0; padding: 4px 18px; }
li { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 12px 0; }
li + li { border-top: 1px solid var(--line); }
.name { display: inline-flex; align-items: center; gap: 10px; font-size: 15.5px; font-weight: 600; color: var(--ink); min-width: 0; }
.name i { font-style: normal; width: 26px; height: 26px; border-radius: 8px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--ink-3); font-size: 12.5px; font-variant-numeric: tabular-nums; }
@media (max-width: 520px) {
  li { flex-direction: column; align-items: stretch; gap: 8px; }
}
</style>
