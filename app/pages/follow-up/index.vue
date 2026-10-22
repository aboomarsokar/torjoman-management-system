<script setup lang="ts">
/**
 * «متابعة الرصد» (طلب المستخدم 2026-10-22) — لمشرف المشروع (القسمان، اطّلاعاً) والمدير الإداري (القسمان)، والمدير الفنيّ (البنين، اطّلاعاً: صفحتا الحضور
 * والرصد اللتان تقود إليهما قراءةٌ له)، والمديرة الإدارية (البنات):
 * أيُّ الحلقات رصدت حضورها وشهرَها القرآنيّ في المهلة وأيُّها قصّرت، بنظرة. المحتوى `DashboardRecordingFollowUp`.
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'متابعة الرصد — ترجمان' })

const { role, isAdmin, isTechnical, isReadOnly, isWomenAdmin, isFieldSupervisor } = usePermissions()
// isReadOnly = مشرف المشروع: يطّلع على القسمين؛ والمشرفُ الميدانيّ حلقاتِه المكلَّف بها (2026-10-22) — وصفحتا الحضور والرصد قراءةٌ لهما
const canView = computed(() => isAdmin.value || isTechnical.value || isReadOnly.value || isWomenAdmin.value || isFieldSupervisor.value)
// المخاطبةُ بجنس القارئ (المديرة والمشرفة)
const { profile } = useProfile()
const fem = computed(() => profile.value?.gender === 'female')
</script>

<template>
  <div class="fu">
    <UiPageHeader
      title="متابعة الرصد"
      :subtitle="fem
        ? 'رصدُ الحضور في أيام الدوام ورصدُ الشهر القرآنيّ لحلقاتك — الأشدُّ تقصيراً أولاً، وتواصلي مع المعلّمة من سطرها.'
        : 'رصدُ الحضور في أيام الدوام ورصدُ الشهر القرآنيّ لحلقاتك — الأشدُّ تقصيراً أولاً، وتواصل مع المعلّم من سطره.'"
    />
    <UiEmptyState
      v-if="role && !canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للإدارة."
    />
    <ClientOnly v-else-if="canView">
      <DashboardRecordingFollowUp page />
    </ClientOnly>
  </div>
</template>
