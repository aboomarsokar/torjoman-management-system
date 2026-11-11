<script setup lang="ts">
/**
 * «البرامج المصاحبة» (طلب المستخدم 2026-10-21) — مركزُ المقرّرات الشهرية:
 * · الطالب: بطاقةُ مقرّره المستحقّ (تنزيلُ ملفّه وزرُّ الاختبار) ثم محطّاتُ المقرّرات (وتنزيلُ المجتاز).
 * · العاملون: تبويبان (طلب المستخدم 2026-10-22) — «إنجاز الطلاب» لحلقاتهم اطّلاعاً (المشرفُ حلقاتُه، والمعلمُ حلقتُه)،
 *   و«المقرّرات» بكتبها وملفّاتها؛ والتبويبُ في الرابط (`?tab=units`) كي يبقى عند التحديث والرجوع.
 * · المديرُ الإداريّ وحده: ومعها رفعُ الملفّات وإضافةُ المقرّرات والكتب (والفنيُّ يطّلع — قرار 2026-10-22).
 * · خارطةُ الشهر الأسبوعية (2026-11-10): للطالب تحت بطاقته، وللعاملين تبويبٌ أوّل يتصفّحون فيه أيَّ شهر (`?tab=roadmap`).
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'البرامج المصاحبة — ترجمان' })

const { role } = useProfile()
const isStudent = computed(() => role.value === 'student')
// رفعُ الملفّات وإضافةُ المقرّرات للمدير الإداري وحده؛ والفنيُّ يطّلع (قرار 2026-10-22)
const canManage = computed(() => role.value === 'admin_manager')
const me = useMyReadingStudent()

const route = useRoute()
type Tab = 'progress' | 'roadmap' | 'units'
const tabs = [
  { value: 'progress' as const, label: 'إنجاز الطلاب' },
  { value: 'roadmap' as const, label: 'خارطة الشهر' },
  { value: 'units' as const, label: 'المقرّرات' }
]
const tab = computed<Tab>({
  get: () => route.query.tab === 'units' || route.query.tab === 'roadmap' ? route.query.tab : 'progress',
  set: v => navigateTo({ query: { ...route.query, tab: v === 'progress' ? undefined : v } }, { replace: true })
})
</script>

<template>
  <div
    class="pg"
    :class="{ narrow: isStudent }"
  >
    <UiPageHeader
      title="البرامج المصاحبة"
      :subtitle="isStudent ? 'مقرّرُك الشهري: نزّله واقرأه أسبوعاً أسبوعاً، ثم تقدّم لاختباره في آخر الشهر.' : 'المقرّراتُ الشهرية بكتبها وصفحاتها وخارطتها الأسبوعية وملفّاتها.'"
    />
    <OfflineSavedNote :keys="['reading-units', 'reading-progress-*']" />
    <ClientOnly>
      <template v-if="isStudent">
        <template v-if="me">
          <StudentReadingCard
            :student-id="me.id"
            :enrollment-date="me.enrollment_date"
            self
            heading="مقرّرك الحالي"
          />
          <ReadingMonthRoadmap />
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
        <ReadingMonthRoadmap
          v-else-if="tab === 'roadmap'"
          browse
          class="roadmap-tab"
        />
        <ReadingUnitsList
          v-else
          :manage="canManage"
        />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
/* العاملون بعرض الشاشة كاملاً (طلب المستخدم 2026-11-11)، والطالبُ بعرض القراءة */
.pg.narrow { max-width: 860px; }
.tabs { margin-bottom: 16px; }
.roadmap-tab { margin-top: 0; }
</style>
