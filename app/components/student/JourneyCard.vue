<script setup lang="ts">
/**
 * بطاقة رحلة الطالب على دورات الاختبار (للقراءة فقط) — مشتركة بين ملف الطالب الداخلي
 * وصفحة «صفحتي». البياناتُ من `useStudentJourneyData` (المصدرُ نفسه للوحة تحكّم الطالب)،
 * وكلّ ما يُجلب خاضعٌ لـRLS: الطالب لا يرى إلا ما يخصّه — وبـ`ownRecords` يقرأ بدوالّه الخاصّة.
 * تحت الرحلة «سجلّ الشهور» و«وصل N من 30 جزءاً».
 */
interface Props {
  studentId: string
  quranParts: number | null
  enrollmentDate: string | null
  /** الطالب نفسه يعرض رحلته (يقرأ بدوالّه الخاصّة لا بالتضمين). */
  ownRecords?: boolean
  /** بلا إطار البطاقة ولا عنوانها — حين يكون التبويبُ نفسُه عنواناً. */
  bare?: boolean
}

const props = withDefaults(defineProps<Props>(), { ownRecords: false, bare: false })

const { targetPerMonth, cycles, examResults, memorizationPages, history, juzDone } = useStudentJourneyData(() => ({
  studentId: props.studentId,
  quranParts: props.quranParts,
  ownRecords: props.ownRecords
}))
</script>

<template>
  <section
    class="card journey"
    :class="{ bare }"
  >
    <h3 v-if="!bare">
      <span class="ico"><UIcon
        name="i-lucide-route"
        class="size-5"
      /></span>
      رحلة الطالب على دورات الاختبار
    </h3>
    <StudentJourney
      :quran-parts="quranParts"
      :cycles="cycles"
      :results="examResults"
      :memorization-pages="memorizationPages"
      :target-per-month="targetPerMonth"
      :enrollment-date="enrollmentDate"
    />
    <StudentQuranHistory
      :items="history"
      :juz-done="juzDone"
    />
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); }
.journey { margin-top: 22px; }
.journey.bare { margin-top: 0; }
.card h3 { margin: 0 0 18px; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
.ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--green-soft); color: var(--green-ink); }
@media (max-width: 640px) { .card { padding: 18px; } }
</style>
