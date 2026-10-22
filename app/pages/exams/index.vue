<script setup lang="ts">
/**
 * الاختبارات (§4.16) بالدورات المرحليّة (`exam_cycles`) — موجّهة بالدور:
 * - المعلّم: يرشّح كلَّ طالبٍ لدورته المستحقّة الثابتة ويرسل القائمة، ويسحب المعلّق (ExamsNominate).
 * - المختبِر لحلقاته والمديران احتياطاً: طابورُ الرصد بالدورة (ExamsGradeQueue + ExamsGradeModal)؛
 *   الاجتيازُ يرفع الأجزاء بمُشغِّلٍ في القاعدة، وإشعارا الترشيح والرصد يصدران منها تلقائياً.
 * - الجميع: متابعة النتائج حسب النطاق (ExamsResultsBrowser بفلاتر هرمية).
 */
import { EXAM_MAX_TOTAL } from '~/constants/exams'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الاختبارات — ترجمان' })

const { isTeacher, isManager, isExaminer, isWomenAdmin } = usePermissions()
/** الرصد: المختبِر لحلقاته، والمديران (الإداري والفني) احتياطاً — كما يسمح RLS. */
const canGrade = computed(() => isManager.value || isExaminer.value)

const subtitle = computed(() => {
  if (isTeacher.value) return 'لكلّ طالبٍ دورتُه المستحقّة بالترتيب — حدّد من تراه جاهزاً وأرسل القائمة للمختبِر.'
  if (canGrade.value) return `الاختبارات الواردة من المعلّمين — افتح كلّ اختبار وارصد نتيجته من ${EXAM_MAX_TOTAL}، وتابع النتائج في نطاقك.`
  return isWomenAdmin.value ? 'تابعي نتائج اختبارات الطالبات في قسمك.' : 'تابع نتائج اختبارات الطلاب في نطاقك.'
})

const resultsRef = ref<{ refresh: () => Promise<void> } | null>(null)
async function onGraded() {
  await resultsRef.value?.refresh()
}
</script>

<template>
  <div class="exams">
    <UiPageHeader
      title="الاختبارات"
      :subtitle="subtitle"
    />

    <ClientOnly>
      <ExamsNominate v-if="isTeacher" />
      <ExamsGradeQueue
        v-else-if="canGrade"
        @graded="onGraded"
      />

      <!-- النتائج (للجميع، بفلاتر هرمية حسب النطاق) -->
      <div class="results-slot">
        <ExamsResultsBrowser ref="resultsRef" />
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.results-slot { margin-top: 30px; }
</style>
