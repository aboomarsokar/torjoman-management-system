<script setup lang="ts">
/**
 * طلباتُ الملازم في أرشيف الملازم (المدير الإداري — طلب المستخدم 2026-10-25): المفتوحةُ أوّلاً بشارة «جديد»،
 * والمعلّمُ وحلقتُه والملزمةُ وعددُ النسخ والملاحظةُ والتاريخ، و«تمّ التسليم» يُغلق الطلب. مشرفُ المشروع يقرأ.
 */
import { BOOKLETS } from '~/constants/booklets'
import type { BookletRequest } from '~/composables/useBookletRequests'
import { deliveryDate } from '~/utils/booklets'

defineProps<{ rows: BookletRequest[], canClose: boolean, busy: boolean }>()
const emit = defineEmits<{ close: [id: string] }>()

const label = (n: number) => BOOKLETS.find(b => b.no === n)?.label ?? `الملزمة ${n}`
const columns = [
  { key: 'num', label: '#' },
  { key: 'who', label: 'المعلّم والحلقة' },
  { key: 'booklet', label: 'الطلب' },
  { key: 'date', label: 'التاريخ', class: 'col-date' },
  { key: 'state', label: 'الحالة' },
  { key: 'actions', label: '', align: 'end' as const }
]
</script>

<template>
  <UiEmptyState
    v-if="!rows.length"
    icon="i-lucide-inbox"
    title="لا طلباتِ ملازم بعد"
    description="يطلب المعلّمون الملازمَ من لوحاتهم، فتظهر طلباتُهم هنا ويصلك إشعار."
  />
  <UiDataTable
    v-else
    :columns="columns"
    :rows="rows"
    row-key="id"
    :row-class="(r: BookletRequest) => r.status === 'open' ? 'is-new' : undefined"
  >
    <template #num="{ index }">
      <span class="seq-n">{{ index + 1 }}</span>
    </template>
    <template #who="{ row }">
      <div class="who">
        <b>{{ row.halaqa?.teacher?.full_name ?? '—' }}</b>
        <span>{{ row.halaqa?.name ?? '—' }}</span>
      </div>
    </template>
    <template #booklet="{ row }">
      <div class="req">
        <span class="chip">{{ label(row.booklet) }} <b>× {{ row.copies }}</b></span>
        <span
          v-if="row.note"
          class="note"
        >{{ row.note }}</span>
      </div>
    </template>
    <template #date="{ row }">
      <bdi
        dir="ltr"
        class="date"
      >{{ deliveryDate(row.created_at) }}</bdi>
    </template>
    <template #state="{ row }">
      <UBadge
        v-if="row.status === 'open'"
        label="جديد"
        color="warning"
        variant="solid"
        class="new-badge"
      />
      <UBadge
        v-else
        label="تمّ التسليم"
        color="success"
        variant="soft"
      />
    </template>
    <template #actions="{ row }">
      <UButton
        v-if="canClose && row.status === 'open'"
        label="تمّ التسليم"
        icon="i-lucide-check"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="busy"
        :ui="{ base: 'rounded-[10px]' }"
        @click="emit('close', row.id)"
      />
    </template>
    <template #card="{ row, index }">
      <UiCardRow
        :title="row.halaqa?.teacher?.full_name ?? '—'"
        :subtitle="row.halaqa?.name ?? ''"
        :fields="[
          { label: 'الطلب', value: `${label(row.booklet)} × ${row.copies}` },
          ...(row.note ? [{ label: 'ملاحظة', value: row.note }] : []),
          { label: 'التاريخ', value: deliveryDate(row.created_at) }
        ]"
      >
        <template #lead>
          <span class="seq-n">{{ index + 1 }}</span>
        </template>
        <template #badge>
          <UBadge
            :label="row.status === 'open' ? 'جديد' : 'تمّ التسليم'"
            :color="row.status === 'open' ? 'warning' : 'success'"
            :variant="row.status === 'open' ? 'solid' : 'soft'"
          />
        </template>
        <template
          v-if="canClose && row.status === 'open'"
          #actions
        >
          <UButton
            label="تمّ التسليم"
            icon="i-lucide-check"
            color="neutral"
            variant="outline"
            :loading="busy"
            :ui="{ base: 'rounded-[11px]' }"
            @click="emit('close', row.id)"
          />
        </template>
      </UiCardRow>
    </template>
  </UiDataTable>
</template>

<style scoped>
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.who { display: flex; flex-direction: column; line-height: 1.45; min-width: 180px; }
.who b { color: var(--ink); font-weight: 600; white-space: nowrap; }
.who span { font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.req { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.chip { padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; white-space: nowrap; }
.chip b { color: var(--blue-ink); font-variant-numeric: tabular-nums; }
.note { font-size: 13px; color: var(--ink-2); }
.date { color: var(--ink-2); font-size: 14px; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* الطلبُ الجديدُ يُرى من بعيد: خلفيةٌ خفيفةٌ من لون الشارة */
:deep(tr.is-new) { background: color-mix(in srgb, var(--ui-warning) 7%, transparent); }
@container dt (max-width: 899px) {
  :deep(.col-date) { display: none; }
}
</style>
