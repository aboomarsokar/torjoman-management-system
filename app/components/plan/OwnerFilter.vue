<script setup lang="ts">
/**
 * تصفيةُ أنشطة خطة القسم بالمسؤول (طلب المستخدم 2026-10-30): قائمةٌ بالعاملين الذين لهم أنشطةٌ في الخطة مع عدد أنشطة كلٍّ
 * منهم، وشارةٌ بعدد ما يُعرض وزرٌّ لإلغاء التصفية.
 */
import type { DeptTask } from '~/composables/useDeptPlan'
import { ALL_OWNERS } from '~/constants/deptPlan'

const props = defineProps<{ tasks: DeptTask[], names: Record<string, string>, shown: number }>()
const owner = defineModel<string>({ required: true })

const items = computed(() => {
  const counts = new Map<string, number>()
  for (const t of props.tasks) for (const id of t.owners) counts.set(id, (counts.get(id) ?? 0) + 1)
  const people = [...counts]
    .map(([id, n]) => ({ label: props.names[id] ?? '—', value: id, count: n }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'))
  return [{ label: 'كل المسؤولين', value: ALL_OWNERS, count: props.tasks.length }, ...people]
})
const active = computed(() => owner.value !== ALL_OWNERS)
/** تمييزُ العدد بالعربية: نشاط · نشاطان · 3 أنشطة · 15 نشاطاً. */
const countLabel = computed(() => {
  const n = props.shown
  if (n === 1) return 'نشاط واحد'
  if (n === 2) return 'نشاطان'
  return n >= 3 && n <= 10 ? `${n} أنشطة` : `${n} نشاطاً`
})
</script>

<template>
  <div
    class="of"
    :class="{ active }"
  >
    <span class="of-lbl">
      <UIcon
        name="i-lucide-user-search"
        class="size-4.5"
      />
      المسؤول
    </span>
    <USelectMenu
      v-model="owner"
      :items="items"
      value-key="value"
      :search-input="{ placeholder: 'ابحث بالاسم' }"
      aria-label="تصفية بالمسؤول"
      class="of-select"
      :ui="{ base: `rounded-[12px] min-h-11 cursor-pointer w-72 max-w-full ${active ? 'ring-2 ring-(--blue)' : ''}`, content: 'min-w-72 max-w-[92vw]' }"
    >
      <template #item-trailing="{ item }">
        <span class="of-n">{{ item.count }}</span>
      </template>
    </USelectMenu>
    <template v-if="active">
      <span class="of-count">{{ countLabel }}</span>
      <UButton
        icon="i-lucide-x"
        label="إلغاء التصفية"
        color="neutral"
        variant="ghost"
        size="sm"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
        @click="owner = ALL_OWNERS"
      />
    </template>
  </div>
</template>

<style scoped>
.of { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.of-lbl { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--ink-2); font-size: 14px; }
.of-select { max-width: 100%; }
.of-n {
  min-width: 24px; padding: 0 7px; border-radius: 999px; background: var(--surface-3); color: var(--ink-3);
  font-size: 12px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums;
}
.of-count {
  padding: 2px 10px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink);
  font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
}
</style>
