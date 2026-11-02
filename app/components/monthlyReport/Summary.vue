<script setup lang="ts">
/**
 * بطاقاتُ خلاصة التقرير الشهريّ: الحضور، والإنجازُ القرآنيّ بدرجاته، وإنجازُ المعلم (أعلى 12)، والاختبارات، واختبارُ القراءة.
 */
import type { Outcome } from '~/utils/quran/plan'
import { ACHIEVEMENT_TOP_N, achievementPct } from '~/utils/halaqatAchievement'

interface Props {
  outcomes: Record<Outcome, number>
  attendancePct: number | null
  exams: { total: number, passed: number }
  reading: { total: number, passed: number }
}
const props = defineProps<Props>()

const teacherPct = computed(() => achievementPct(props.outcomes))
</script>

<template>
  <section
    class="ms"
    aria-label="خلاصة الشهر"
  >
    <UiStatCard
      icon="i-lucide-calendar-check"
      :value="attendancePct === null ? '—' : `${attendancePct}%`"
      label="الحضور"
      tone="blue"
    />
    <UiStatCard
      icon="i-lucide-book-check"
      :value="outcomes.done"
      label="أنجزوا"
      tone="green"
      :sub="`قريب ${outcomes.near} · مقصّر ${outcomes.short}${outcomes.absentee ? ` · كثير الغياب ${outcomes.absentee}` : ''}`"
    />
    <UiStatCard
      icon="i-lucide-gauge"
      :value="teacherPct === null ? '—' : `${teacherPct}%`"
      label="إنجاز المعلم"
      tone="neutral"
      :sub="`أعلى ${ACHIEVEMENT_TOP_N} طالباً`"
    />
    <UiStatCard
      icon="i-lucide-clipboard-list"
      :value="exams.total"
      label="اختبارات الشهر"
      tone="blue"
      :sub="`ناجح ${exams.passed}`"
    />
    <UiStatCard
      icon="i-lucide-library"
      :value="reading.total"
      label="اختبار القراءة"
      tone="green"
      :sub="`اجتاز ${reading.passed}`"
    />
  </section>
</template>

<style scoped>
.ms { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
</style>
