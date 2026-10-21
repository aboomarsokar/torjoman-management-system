<script setup lang="ts">
/**
 * سجلُّ تسليمات الملازم بترتيبها (الأحدثُ أوّلاً): التاريخُ والحلقةُ والملزمةُ والنسخُ والملاحظة.
 * زرُّ الحذف للمدير الإداري وحده (لتسليمٍ سُجّل خطأً) — والتأكيدُ في الصفحة.
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

const items = computed(() => props.rows.map(r => ({
  row: r,
  halaqa: props.halaqaNames[r.halaqa_id] ?? '—',
  booklet: BOOKLETS[r.booklet - 1]?.label ?? `الملزمة ${r.booklet}`
})))
</script>

<template>
  <ul class="list">
    <li
      v-for="i in items"
      :key="i.row.id"
      class="card lrow"
    >
      <span class="date num">{{ deliveryDate(i.row.delivered_on) }}</span>
      <div class="main">
        <span class="what"><b>{{ i.halaqa }}</b> · {{ i.booklet }}</span>
        <span
          v-if="i.row.note"
          class="note"
        >{{ i.row.note }}</span>
      </div>
      <span class="copies"><b class="num">{{ i.row.copies }}</b> نسخة</span>
      <UButton
        v-if="canDelete"
        color="error"
        variant="ghost"
        icon="i-lucide-trash-2"
        aria-label="حذف التسليم"
        class="min-h-11 min-w-11 justify-center"
        @click="emit('delete', i.row)"
      />
    </li>
  </ul>
</template>

<style scoped>
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
.lrow { padding: 10px 16px; display: flex; align-items: center; gap: 14px; }
.date { font-size: 13px; color: var(--ink-3); flex: none; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.what { color: var(--ink-2); font-size: 14.5px; }
.what b { color: var(--ink); font-weight: 600; }
.note { font-size: 12.5px; color: var(--ink-3); }
.copies { flex: none; font-size: 13px; color: var(--ink-3); }
.copies b { font-size: 16px; color: var(--navy); font-weight: 600; }
.num { font-variant-numeric: tabular-nums; }
@media (max-width: 520px) {
  .lrow { flex-wrap: wrap; }
  .main { order: -1; flex-basis: 100%; }
}
</style>
