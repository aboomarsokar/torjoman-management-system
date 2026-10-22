<script setup lang="ts">
/**
 * «البرامج المصاحبة» (طلب المستخدم 2026-10-21) — مركزُ المقرّرات الشهرية:
 * · الطالب: بطاقةُ مقرّره المستحقّ (تنزيلُ ملفّه وزرُّ الاختبار) ثم محطّاتُ المقرّرات (وتنزيلُ المجتاز).
 * · العاملون: تبويبان (طلب المستخدم 2026-10-22) — «إنجاز الطلاب» لحلقاتهم اطّلاعاً (المشرفُ حلقاتُه، والمعلمُ حلقتُه)،
 *   و«المقرّرات» بكتبها وملفّاتها؛ والتبويبُ في الرابط (`?tab=units`) كي يبقى عند التحديث والرجوع.
 * · المديرُ الإداريّ وحده: ومعها رفعُ الملفّات وإضافةُ المقرّرات والكتب (والفنيُّ يطّلع — قرار 2026-10-22).
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'البرامج المصاحبة — ترجمان' })

const { role } = useProfile()
const isStudent = computed(() => role.value === 'student')
// رفعُ الملفّات وإضافةُ المقرّرات للمدير الإداري وحده؛ والفنيُّ يطّلع (قرار 2026-10-22)
const canManage = computed(() => role.value === 'admin_manager')
const me = useMyReadingStudent()

const route = useRoute()
type Tab = 'progress' | 'units'
const tabs = [
  { value: 'progress' as const, label: 'إنجاز الطلاب' },
  { value: 'units' as const, label: 'المقرّرات' }
]
const tab = computed<Tab>({
  get: () => route.query.tab === 'units' ? 'units' : 'progress',
  set: v => navigateTo({ query: { ...route.query, tab: v === 'units' ? 'units' : undefined } }, { replace: true })
})
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
        <UiFilterChips
          v-model="tab"
          :options="tabs"
          class="tabs"
        />
        <ReadingProgressList v-if="tab === 'progress'" />
        <ReadingUnitsList
          v-else
          :manage="canManage"
        />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.pg { max-width: 860px; }
.tabs { margin-bottom: 16px; }
</style>
