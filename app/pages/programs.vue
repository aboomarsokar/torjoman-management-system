<script setup lang="ts">
/**
 * «البرامج المصاحبة» (طلب المستخدم 2026-10-21) — مركزُ المقرّرات الشهرية:
 * · الطالب: بطاقةُ مقرّره المستحقّ (تنزيلُ ملفّه وزرُّ الاختبار) ثم محطّاتُ المقرّرات (وتنزيلُ المجتاز).
 * · العاملون: «إنجاز الطلاب» لحلقاتهم اطّلاعاً (المشرفُ حلقاتُه، والمعلمُ حلقتُه)، ثم كلُّ المقرّرات بكتبها وملفّاتها.
 * · المديرُ الإداريّ والمديرُ الفنيّ: ومعها رفعُ الملفّات وإضافةُ المقرّرات والكتب.
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'البرامج المصاحبة — ترجمان' })

const { role } = useProfile()
const isStudent = computed(() => role.value === 'student')
const canManage = computed(() => role.value === 'admin_manager' || role.value === 'technical_manager')
const me = useMyReadingStudent()
</script>

<template>
  <div class="pg">
    <UiPageHeader
      title="البرامج المصاحبة"
      :subtitle="isStudent ? 'مقرّرُك الشهري: نزّله واقرأه، ثم تقدّم لاختباره.' : 'المقرّراتُ الشهرية بكتبها وصفحاتها وملفّاتها.'"
    />
    <ClientOnly>
      <template v-if="isStudent">
        <template v-if="me">
          <StudentReadingCard
            :student-id="me.id"
            :enrollment-date="me.enrollment_date"
            self
            heading="مقرّرك الحالي"
          />
          <StudentReadingStations
            :student-id="me.id"
            :enrollment-date="me.enrollment_date"
            heading="كلّ المقرّرات"
          />
        </template>
        <UiSkeletonLines
          v-else
          :fields="4"
        />
      </template>
      <template v-else-if="role">
        <ReadingProgressList />
        <h2 class="sec">
          المقرّرات
        </h2>
        <ReadingUnitsList :manage="canManage" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.pg { max-width: 860px; }
.sec { margin: 22px 4px 10px; font-size: 17px; font-weight: 700; color: var(--ink); }
</style>
