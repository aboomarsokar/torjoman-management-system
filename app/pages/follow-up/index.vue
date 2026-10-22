<script setup lang="ts">
/**
 * «متابعة الرصد» (طلب المستخدم 2026-10-22) — للمدير الفنيّ (البنين) والمديرة الإدارية (البنات):
 * أيُّ الحلقات رصدت حضورها وشهرَها القرآنيّ في المهلة وأيُّها قصّرت، بنظرة. المحتوى `DashboardRecordingFollowUp`.
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'متابعة الرصد — ترجمان' })

const { role, isTechnical, isWomenAdmin: fem } = usePermissions()
const canView = computed(() => isTechnical.value || fem.value)
</script>

<template>
  <div class="fu">
    <UiPageHeader
      title="متابعة الرصد"
      :subtitle="fem
        ? 'رصدُ الحضور في أيام الدوام ورصدُ الشهر القرآنيّ لحلقات قسمك — الأشدُّ تقصيراً أولاً، وتواصلي مع المعلّمة من سطرها.'
        : 'رصدُ الحضور في أيام الدوام ورصدُ الشهر القرآنيّ لحلقات قسمك — الأشدُّ تقصيراً أولاً، وتواصل مع المعلّم من سطره.'"
    />
    <UiEmptyState
      v-if="role && !canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الفني والمديرة الإدارية."
    />
    <ClientOnly v-else-if="canView">
      <DashboardRecordingFollowUp page />
    </ClientOnly>
  </div>
</template>
