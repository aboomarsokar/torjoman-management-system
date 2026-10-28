<script setup lang="ts">
/**
 * قائمةُ طلاب اليوم في شاشة حضور المعلّم — بشكل تطبيق الصحابة (طلب المستخدم 2026-10-28): ملخّصٌ صغير «حاضر N · غائب N»
 * في الأعلى، ثمّ لكلّ طالبٍ اسمُه (بلا رقم هوية) واختيارُ حاله (`OfflineAttendanceChoice`: حاضر · غائب · «…» غائب بعذر).
 * المسوّدةُ عند الأب، وهنا العرضُ والاختيار.
 */
import type { AttendanceChoice, DaySummary } from '~/composables/useAttendanceDay'
import type { MirrorStudent } from '~/composables/useOfflineMirror'
import type { Absences } from '~/utils/attendanceOutbox'

const props = defineProps<{ students: MirrorStudent[], draft: Absences, summary: DaySummary, disabled: boolean }>()
const emit = defineEmits<{ set: [studentId: string, choice: AttendanceChoice] }>()
const absent = computed(() => props.summary.excused + props.summary.unexcused)
</script>

<template>
  <section class="al">
    <p
      class="al-sum"
      aria-live="polite"
    >
      <span class="p">حاضر <b>{{ summary.present }}</b></span>
      <span class="dot">·</span>
      <span class="a">غائب <b>{{ absent }}</b></span>
      <template v-if="summary.excused">
        <span class="hint">(منهم {{ summary.excused }} بعذر)</span>
      </template>
    </p>
    <ul>
      <li
        v-for="(s, i) in students"
        :key="s.id"
      >
        <span class="name"><i>{{ i + 1 }}</i><span class="n">{{ s.full_name }}</span></span>
        <OfflineAttendanceChoice
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
.al-sum { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; padding: 12px 18px; border-bottom: 1px solid var(--line); font-size: 14px; font-weight: 600; color: var(--ink-2); }
.al-sum b { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.al-sum .p b { color: var(--green-ink); }
.al-sum .a b { color: var(--err); }
.al-sum .dot { color: var(--ink-3); }
.al-sum .hint { font-size: 13px; font-weight: 500; color: var(--ink-3); }
ul { list-style: none; margin: 0; padding: 4px 18px; }
li { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; }
li + li { border-top: 1px solid var(--line); }
.name { display: inline-flex; align-items: center; gap: 10px; font-size: 15.5px; font-weight: 600; color: var(--ink); min-width: 0; }
.name .n { min-width: 0; }
.name i { font-style: normal; width: 26px; height: 26px; border-radius: 8px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--ink-3); font-size: 12.5px; font-variant-numeric: tabular-nums; }
@media (max-width: 620px) {
  li { flex-direction: column; align-items: stretch; gap: 10px; }
}
</style>
