<script setup lang="ts">
/**
 * شريطُ فلاتر قوائم الحلقات الموحّد (طلب المستخدم 2026-11-09): البحثُ باسم الحلقة أو المعلم، والجنسُ (متى اجتمع
 * القسمان) والمشرفُ المسنَد (متى تعدّد) — قوائمُ بارتفاعٍ واحد (48px). والمكانُ الافتراضيّ (slot) لفلاتر الصفحة الخاصّة
 * (كحالة التقرير) — يُنسّقها صاحبُها بعرض 220px وارتفاع 48px. لا منطقَ فيه: القيمُ والخياراتُ من `useHalaqaFilters`.
 */
import { ALL_SUPERVISORS, type GenderFilter, type HalaqaFilters } from '~/utils/halaqaFilters'

interface Props {
  filters: HalaqaFilters
  genderItems: { value: GenderFilter, label: string }[]
  supItems: { value: string, label: string }[]
  showGender: boolean
  showSupervisor: boolean
  /** عددُ المعروض والكلّ — للبحث. */
  shown: number
  total: number
  placeholder?: string
  /** اسمُ فلتر المسؤول — «المشرف» افتراضاً، و«المختبِر» في طابور الرصد. */
  supLabel?: string
  supAllLabel?: string
}
const props = withDefaults(defineProps<Props>(), { placeholder: 'ابحث باسم الحلقة أو المعلّم', supLabel: 'المشرف', supAllLabel: 'كلّ المشرفين' })
const emit = defineEmits<{ update: [Partial<HalaqaFilters>] }>()

const supervisorItems = computed(() => [{ value: ALL_SUPERVISORS, label: props.supAllLabel }, ...props.supItems])

const gender = computed({ get: () => props.filters.gender, set: v => emit('update', { gender: v }) })
const supervisor = computed({ get: () => props.filters.supervisor, set: v => emit('update', { supervisor: v }) })
const query = computed({ get: () => props.filters.query, set: v => emit('update', { query: v }) })
</script>

<template>
  <div class="hf">
    <div class="hf-search">
      <UiSearchField
        v-model="query"
        :placeholder="placeholder"
        :shown="shown"
        :total="total"
      />
    </div>
    <div
      v-if="showGender"
      class="hf-sel"
    >
      <UiSelect
        v-model="gender"
        :items="genderItems"
        size="xl"
        class="w-full"
        aria-label="القسم"
      />
    </div>
    <div
      v-if="showSupervisor"
      class="hf-sel"
    >
      <UiSelect
        v-model="supervisor"
        :items="supervisorItems"
        size="xl"
        class="w-full"
        :aria-label="supLabel"
      />
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* صفُّ أدواتٍ واحد بارتفاعٍ واحد (48px): البحثُ يتمدّد والقوائمُ بعرضٍ ثابت */
.hf { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; }
.hf-search { flex: 1 1 280px; min-inline-size: 0; }
.hf-sel { flex: 0 0 220px; }
.hf-sel :deep(button) { min-block-size: 48px; }
@media (max-width: 640px) {
  .hf-sel { flex: 1 1 100%; }
}
</style>
