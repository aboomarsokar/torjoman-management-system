<script setup lang="ts">
/**
 * الملف المالي (§4.20) — للمدير الإداري (ومشرف المشروع عرضاً بلا كتابة).
 * مركز مالي بالشيكل، أربعة تبويبات: نظرة عامة · سجلّ الحركات · الرواتب الشهرية · حوافز الحلقات.
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الملف المالي — ترجمان' })

const { isAdmin, isReadOnly } = usePermissions()
const canView = computed(() => isAdmin.value || isReadOnly.value)

const tabs = [
  { key: 'overview', label: 'نظرة عامة', icon: 'i-lucide-layout-dashboard' },
  { key: 'transactions', label: 'سجلّ الحركات', icon: 'i-lucide-arrow-left-right' },
  { key: 'salaries', label: 'الرواتب الشهرية', icon: 'i-lucide-wallet' },
  { key: 'incentives', label: 'حوافز الحلقات', icon: 'i-lucide-gift' }
]
const tab = ref('overview')
</script>

<template>
  <div class="finance">
    <UiPageHeader
      title="الملف المالي"
      subtitle="المركز المالي للمشروع بالشيكل (₪) — نظرة عامة وحركات ورواتب وحوافز."
    />

    <UiEmptyState
      v-if="!canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري فقط."
    />

    <template v-else>
      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >
          <UIcon
            :name="t.icon"
            class="size-[18px]"
          />
          {{ t.label }}
        </button>
      </div>

      <FinanceOverview v-if="tab === 'overview'" />
      <FinanceTransactions v-else-if="tab === 'transactions'" />
      <FinanceSalaries v-else-if="tab === 'salaries'" />
      <FinanceIncentives v-else-if="tab === 'incentives'" />
    </template>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 6px; margin-bottom: 22px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.tab { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; font-size: 14.5px; font-weight: 600; color: var(--ink-3); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all .15s; margin-bottom: -1px; }
.tab:hover { color: var(--ink); }
.tab.active { color: var(--blue-ink); border-bottom-color: var(--blue); }
</style>
