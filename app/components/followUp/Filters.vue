<script setup lang="ts">
/**
 * شريطُ فلاتر «متابعة الرصد» (طلب المستخدم 2026-11-09): الجنسُ (متى اجتمع القسمان) والمشرفُ المسنَد (متى تعدّد)
 * والبحثُ باسم الحلقة أو المعلم. لا منطقَ فيه: القيمُ والخياراتُ من `useFollowUpFilters`.
 */
import { ALL_SUPERVISORS, type FollowUpFilters, type GenderFilter } from '~/utils/followUpFilters'

interface Props {
  filters: FollowUpFilters
  supItems: { value: string, label: string }[]
  showGender: boolean
  showSupervisor: boolean
  /** عددُ المعروض والكلّ — للبحث. */
  shown: number
  total: number
}
const props = defineProps<Props>()
const emit = defineEmits<{ update: [Partial<FollowUpFilters>] }>()

const genderOptions: { value: GenderFilter, label: string }[] = [
  { value: 'all', label: 'القسمان' },
  { value: 'male', label: 'البنين' },
  { value: 'female', label: 'البنات' }
]
const supervisorItems = computed(() => [{ value: ALL_SUPERVISORS, label: 'كلّ المشرفين' }, ...props.supItems])

const gender = computed({ get: () => props.filters.gender, set: v => emit('update', { gender: v }) })
const supervisor = computed({ get: () => props.filters.supervisor, set: v => emit('update', { supervisor: v }) })
const query = computed({ get: () => props.filters.query, set: v => emit('update', { query: v }) })
</script>

<template>
  <div class="fuf">
    <UiSearchField
      v-model="query"
      placeholder="ابحث باسم الحلقة أو المعلّم"
      :shown="shown"
      :total="total"
      class="fuf-search"
    />
    <UiFilterChips
      v-if="showGender"
      v-model="gender"
      :options="genderOptions"
    />
    <UiSelect
      v-if="showSupervisor"
      v-model="supervisor"
      :items="supervisorItems"
      size="lg"
      class="fuf-sup"
      aria-label="المشرف"
      :ui="{ base: 'rounded-[12px] min-h-11' }"
    />
  </div>
</template>

<style scoped>
.fuf { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; }
.fuf-search { flex: 1 1 260px; max-width: 380px; }
.fuf-sup { width: 230px; }
@media (max-width: 560px) {
  .fuf-search, .fuf-sup { flex: 1 1 100%; max-width: none; width: 100%; }
}
</style>
