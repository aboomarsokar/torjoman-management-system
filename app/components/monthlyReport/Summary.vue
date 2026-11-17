<script setup lang="ts">
/**
 * بطاقاتُ خلاصة التقرير الشهريّ: الحضور، والإنجازُ القرآنيّ بدرجاته، وإنجازُ المعلم (`teacher` من `teacherAchievementOf`:
 * أعلى 12 قبل 11/2026، ثم النسبةُ المفتوحة على نصاب المسار)، والاختبارات، واختبارُ القراءة.
 */
import type { Outcome } from '~/utils/quran/plan'

interface Props {
  outcomes: Record<Outcome, number>
  attendancePct: number | null
  exams: { total: number, passed: number }
  reading: { total: number, passed: number }
  /** إنجازُ المعلم ونصُّ أساسه. */
  teacher: { pct: number | null, sub: string }
}
defineProps<Props>()
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
      :value="teacher.pct === null ? '—' : `${teacher.pct}%`"
      label="إنجاز المعلم"
      tone="neutral"
      :sub="teacher.sub"
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
