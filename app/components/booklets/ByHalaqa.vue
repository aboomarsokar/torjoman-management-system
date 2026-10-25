<script setup lang="ts">
/**
 * أرشيفُ الملازم حسب الحلقة — جدولٌ مرقَّمٌ بشكل جدول الطلاب (طلب المستخدم 2026-10-25): الحلقةُ ومعلّمُها،
 * والملازمُ المستلَمة بنُسخها، والمجموع، وآخرُ تسليم. بحثٌ باسم المعلّم/ة أو الحلقة، وفلترا الجنس والاستلام.
 * الحلقاتُ كلُّها تظهر — ومن لم تستلم شيئاً بعلامةٍ أخفت لتُلحظ.
 */
import type { HalaqaBooklets } from '~/utils/booklets'
import { deliveryDate } from '~/utils/booklets'

const props = defineProps<{ rows: HalaqaBooklets[] }>()

const query = ref('')
const genderF = ref<'all' | 'male' | 'female'>('all')
const receivedF = ref<'all' | 'yes' | 'no'>('all')
const genderItems = computed(() => {
  const n = (g: string) => props.rows.filter(h => h.gender === g).length
  return [
    { value: 'all' as const, label: `البنين والبنات (${props.rows.length})` },
    { value: 'male' as const, label: `بنين (${n('male')})` },
    { value: 'female' as const, label: `بنات (${n('female')})` }
  ]
})
const receivedItems = computed(() => {
  const yes = props.rows.filter(h => h.total > 0).length
  return [
    { value: 'all' as const, label: 'كلّ الحلقات' },
    { value: 'yes' as const, label: `استلمت (${yes})` },
    { value: 'no' as const, label: `لم تستلم بعد (${props.rows.length - yes})` }
  ]
})
const filtered = computed(() => props.rows.filter(h =>
  (genderF.value === 'all' || h.gender === genderF.value)
  && (receivedF.value === 'all' || (receivedF.value === 'yes') === (h.total > 0))
  && matchesSearch(query.value, h.teacher, h.name)))
const { page, pageCount, total, pageSize, paged, resetPage } = usePagination(filtered, 20)
watch([query, genderF, receivedF], resetPage)

const columns = [
  { key: 'num', label: '#' },
  { key: 'halqa', label: 'الحلقة' },
  { key: 'booklets', label: 'الملازم المستلَمة' },
  { key: 'total', label: 'النسخ', align: 'center' as const },
  { key: 'last', label: 'آخر تسليم', class: 'col-last' }
]
function clearFilters() {
  query.value = ''
  genderF.value = 'all'
  receivedF.value = 'all'
}
</script>

<template>
  <div class="bh">
    <div class="bh-filters">
      <UiSearchField
        v-model="query"
        placeholder="ابحث باسم المعلّم أو المعلّمة أو الحلقة"
        :shown="filtered.length"
        :total="rows.length"
        class="bh-search"
      />
      <UiSelect
        v-model="genderF"
        :items="genderItems"
        size="xl"
        class="bh-sel"
        aria-label="الجنس"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
      <UiSelect
        v-model="receivedF"
        :items="receivedItems"
        size="xl"
        class="bh-sel"
        aria-label="الاستلام"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
    </div>

    <UiEmptyState
      v-if="!filtered.length"
      icon="i-lucide-search-x"
      title="لا حلقاتٍ لهذا البحث"
      description="جرّب جزءاً من اسم المعلّم أو الحلقة، أو اعرض الكلّ."
    >
      <UButton
        label="مسح البحث والفلاتر"
        color="neutral"
        variant="outline"
        icon="i-lucide-x"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="clearFilters"
      />
    </UiEmptyState>
    <template v-else>
      <UiDataTable
        :columns="columns"
        :rows="paged"
        row-key="id"
        :row-to="(r: HalaqaBooklets) => `/halqat/${r.id}`"
        :row-class="(r: HalaqaBooklets) => r.total ? undefined : 'is-none'"
      >
        <template #num="{ index }">
          <span class="seq-n">{{ (page - 1) * pageSize + index + 1 }}</span>
        </template>
        <template #halqa="{ row }">
          <div class="h-cell">
            <NuxtLink
              :to="`/halqat/${row.id}`"
              class="h-name"
              :title="row.name"
            >{{ row.name }}</NuxtLink>
            <span class="h-teacher">{{ row.teacher ?? '—' }}<span
              v-if="row.status !== 'active'"
              class="stopped"
            > · متوقفة</span></span>
          </div>
        </template>
        <template #booklets="{ row }">
          <span
            v-if="!row.total"
            class="none-txt"
          >لم تستلم ملازم بعد</span>
          <div
            v-else
            class="chips"
          >
            <span
              v-for="b in row.booklets"
              :key="b.no"
              class="chip"
            >{{ b.label }} <b class="num">× {{ b.copies }}</b></span>
          </div>
        </template>
        <template #total="{ row }">
          <span
            class="tot"
            :class="{ zero: !row.total }"
          >{{ row.total }}</span>
        </template>
        <template #last="{ row }">
          <bdi
            v-if="row.lastOn"
            dir="ltr"
            class="date"
          >{{ deliveryDate(row.lastOn) }}</bdi>
          <span
            v-else
            class="dash"
          >—</span>
        </template>
        <template #card="{ row, index }">
          <UiCardRow
            :title="row.name"
            :subtitle="row.teacher ?? ''"
            :to="`/halqat/${row.id}`"
            :fields="[
              { label: 'الملازم', value: row.total ? row.booklets.map((b: HalaqaBooklets['booklets'][number]) => `${b.label} × ${b.copies}`).join('، ') : 'لم تستلم بعد', muted: !row.total },
              { label: 'النسخ', value: String(row.total) },
              { label: 'آخر تسليم', value: row.lastOn ? deliveryDate(row.lastOn) : '—', muted: !row.lastOn }
            ]"
          >
            <template #lead>
              <span class="seq-n">{{ (page - 1) * pageSize + index + 1 }}</span>
            </template>
          </UiCardRow>
        </template>
      </UiDataTable>
      <UiPaginator
        :page="page"
        :page-count="pageCount"
        :total="total"
        :page-size="pageSize"
        @update:page="page = $event"
      />
    </template>
  </div>
</template>

<style scoped>
.bh-filters { display: flex; flex-wrap: wrap; gap: 10px 12px; margin-bottom: 16px; }
.bh-search { flex: 1 1 280px; max-width: 460px; }
.bh-sel { width: 200px; }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.h-cell { display: flex; flex-direction: column; line-height: 1.45; min-width: 190px; }
.h-name { color: var(--ink); font-weight: 600; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
.h-name:hover { color: var(--blue-ink); }
.h-teacher { font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.stopped { color: var(--err); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; white-space: nowrap; }
.chip b { color: var(--blue-ink); font-weight: 700; }
.num, .tot, .date { font-variant-numeric: tabular-nums; }
.tot { font-size: 16px; font-weight: 700; color: var(--ink); }
.tot.zero, .none-txt, .dash { color: var(--ink-3); }
.none-txt { font-size: 13.5px; }
.date { color: var(--ink-2); font-size: 14px; white-space: nowrap; }
.bh :deep(tr.is-none) .h-name { color: var(--ink-2); }
@container dt (max-width: 899px) {
  .bh :deep(.col-last) { display: none; }
}
@media (max-width: 640px) {
  .bh-search { max-width: none; flex-basis: 100%; }
  .bh-sel { flex: 1 1 0; width: auto; min-width: 0; }
}
</style>
