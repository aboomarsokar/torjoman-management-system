<script setup lang="ts">
/**
 * سجلُّ تسليمات الملازم جدولاً مرقّماً بصفحات (طلب المستخدم 2026-10-28) — الأحدثُ أوّلاً: التاريخُ والحلقةُ والملزمةُ
 * والنسخُ والملاحظة، وبطاقاتٌ على الجوال. زرُّ الحذف للمدير الإداري وحده (لتسليمٍ سُجّل خطأً) — والتأكيدُ في الصفحة.
 */
import { BOOKLETS } from '~/constants/booklets'
import type { DeliveryRow } from '~/utils/booklets'
import { deliveryDate } from '~/utils/booklets'

const props = defineProps<{
  rows: DeliveryRow[]
  halaqaNames: Record<string, string>
  canDelete: boolean
}>()
const emit = defineEmits<{ delete: [row: DeliveryRow] }>()

const PAGE_SIZE = 12
const items = computed(() => props.rows.map(r => ({
  ...r,
  halaqa: props.halaqaNames[r.halaqa_id] ?? '—',
  bookletLabel: BOOKLETS[r.booklet - 1]?.label ?? `الملزمة ${r.booklet}`
})))
const { page, pageCount, total, pageSize, paged } = usePagination(items, PAGE_SIZE)
const seq = (index: number) => (page.value - 1) * pageSize + index + 1
const columns = computed(() => [
  { key: 'num', label: '#' },
  { key: 'date', label: 'التاريخ' },
  { key: 'halaqa', label: 'الحلقة' },
  { key: 'bookletLabel', label: 'الملزمة' },
  { key: 'copies', label: 'النسخ', align: 'center' as const },
  { key: 'note', label: 'ملاحظة' },
  ...(props.canDelete ? [{ key: 'actions', label: '', align: 'end' as const }] : [])
])
</script>

<template>
  <div class="log">
    <UiDataTable
      :columns="columns"
      :rows="paged"
      row-key="id"
    >
      <template #num="{ index }">
        <span class="muted num">{{ seq(index) }}</span>
      </template>
      <template #date="{ row }">
        <bdi
          dir="ltr"
          class="num muted"
        >{{ deliveryDate(row.delivered_on) }}</bdi>
      </template>
      <template #halaqa="{ row }">
        <b class="halaqa">{{ row.halaqa }}</b>
      </template>
      <template #bookletLabel="{ row }">
        <span class="chip">{{ row.bookletLabel }}</span>
      </template>
      <template #copies="{ row }">
        <b class="copies num">{{ row.copies }}</b>
      </template>
      <template #note="{ row }">
        <span class="note">{{ row.note || '—' }}</span>
      </template>
      <template #actions="{ row }">
        <UButton
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          aria-label="حذف التسليم"
          class="min-h-10 min-w-10 justify-center"
          @click="emit('delete', row)"
        />
      </template>
      <template #card="{ row, index }">
        <UiCardRow
          :title="row.halaqa"
          :subtitle="deliveryDate(row.delivered_on)"
          subtitle-dir="ltr"
          :fields="[
            { label: 'الملزمة', value: row.bookletLabel },
            { label: 'النسخ', value: String(row.copies) },
            ...(row.note ? [{ label: 'ملاحظة', value: row.note }] : [])
          ]"
        >
          <template #lead>
            <span class="muted num">{{ seq(index) }}</span>
          </template>
          <template
            v-if="canDelete"
            #actions
          >
            <UButton
              label="حذف"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              block
              :ui="{ base: 'rounded-[12px] min-h-11' }"
              @click="emit('delete', row)"
            />
          </template>
        </UiCardRow>
      </template>
    </UiDataTable>
    <UiPaginator
      v-if="total > PAGE_SIZE"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :page-size="pageSize"
      @update:page="page = $event"
    />
  </div>
</template>

<style scoped>
.log { display: flex; flex-direction: column; gap: 12px; }
/* حين تحدّد الصفحةُ ارتفاعَه (عرضُ السجلّ بلا تمريرٍ للصفحة): الجدولُ يملأ ما بقي ويُمرَّر داخله، والرأسُ ثابتٌ في أعلاه */
.log :deep(.dt) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.log :deep(.table-wrap) { flex: 1; min-height: 0; overflow-y: auto; }
.log :deep(.table-wrap th) { top: 0; }
.log > :last-child { flex: none; }
.muted { color: var(--ink-3); font-size: 13px; }
.num { font-variant-numeric: tabular-nums; }
.halaqa { color: var(--ink); font-weight: 600; }
.chip { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; white-space: nowrap; }
.copies { color: var(--navy); font-size: 16px; font-weight: 600; }
.note { color: var(--ink-3); font-size: 13px; }
</style>
