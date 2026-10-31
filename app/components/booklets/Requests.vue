<script setup lang="ts">
/**
 * طلباتُ الملازم في أرشيف الملازم (المدير الإداري — طلب المستخدم 2026-10-25)، بأربع حالات (2026-10-31):
 * «جديد» ← «أُبلغ المعلّم» (إبلاغٌ بالاستلام يفحص المخزون ويحجز النسخ ويُشعر المعلّم، وخلفيةُ الصفّ تتغيّر) ←
 * «تمّ التسليم»، أو «ملغى» بسببٍ يصل المعلّم. تحت كلّ طلبٍ قائمٍ حالُ مخزونه (لا يكفي / عند الحدّ / غيرُ مجرودة).
 * ثلاثةُ تبويبات: بانتظار التسليم · تمّ التسليم · ملغاة. مشرفُ المشروع يقرأ.
 */
import { BOOKLETS } from '~/constants/booklets'
import type { BookletRequest } from '~/composables/useBookletRequests'
import type { StockRow } from '~/utils/bookletStock'
import { deliveryDate } from '~/utils/booklets'
import { isPendingRequest, requestStock, requestStockText, statusMeta } from '~/utils/bookletRequests'

const props = defineProps<{ rows: BookletRequest[], stock: StockRow[], canClose: boolean, busy: boolean }>()
const emit = defineEmits<{
  deliver: [id: string, deliveredOn: string]
  ready: [id: string]
  cancel: [id: string, reason: string]
  chat: [row: BookletRequest]
}>()

type View = 'pending' | 'done' | 'cancelled'
const view = ref<View>('pending')
const byView = computed(() => ({
  pending: props.rows.filter(r => isPendingRequest(r.status)),
  done: props.rows.filter(r => r.status === 'done'),
  cancelled: props.rows.filter(r => r.status === 'cancelled')
}))
const shown = computed(() => byView.value[view.value])
const viewTabs = computed(() => [
  { key: 'pending' as const, label: 'بانتظار التسليم', icon: 'i-lucide-hourglass', count: byView.value.pending.length },
  { key: 'done' as const, label: 'تمّ التسليم', icon: 'i-lucide-package-check', count: byView.value.done.length },
  { key: 'cancelled' as const, label: 'ملغاة', icon: 'i-lucide-package-x', count: byView.value.cancelled.length }
])
const EMPTY: Record<View, { icon: string, title: string, description: string }> = {
  pending: { icon: 'i-lucide-circle-check-big', title: 'لا طلباتٍ بانتظار التسليم', description: 'ما يُسلَّم يظهر في «تمّ التسليم».' },
  done: { icon: 'i-lucide-inbox', title: 'لا طلباتٍ مسلَّمة بعد', description: 'ما تسلّمه يظهر هنا بتاريخه.' },
  cancelled: { icon: 'i-lucide-inbox', title: 'لا طلباتٍ ملغاة', description: 'ما يُلغيه المعلّمُ أو المديرُ يظهر هنا بسببه.' }
}

const label = (n: number) => BOOKLETS.find(b => b.no === n)?.label ?? `الملزمة ${n}`
const summary = (r: BookletRequest | null) => (r ? `${label(r.booklet)} × ${r.copies}` : '')

/** حالُ مخزون كلّ طلبٍ قائم: النصُّ ولونُه. */
const stockNotes = computed(() => new Map(byView.value.pending.map((r) => {
  const s = requestStock(r, props.stock, props.rows)
  return [r.id, { text: requestStockText(s, r.copies), tone: s.kind === 'short' ? 'bad' : 'warn' }]
})))

const toDeliver = ref<BookletRequest | null>(null)
const toCancel = ref<BookletRequest | null>(null)
function confirmDeliver(day: string) {
  if (toDeliver.value) emit('deliver', toDeliver.value.id, day)
  toDeliver.value = null
}
function confirmCancel(reason: string) {
  if (toCancel.value) emit('cancel', toCancel.value.id, reason)
  toCancel.value = null
}
const rowClass = (r: BookletRequest) => (r.status === 'open' ? 'is-new' : r.status === 'ready' ? 'is-ready' : undefined)

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
  <div
    v-else
    class="req-view"
  >
    <UiSegmentTabs
      v-model="view"
      :tabs="viewTabs"
      label="حالة طلبات الملازم"
    />
  </div>
  <UiEmptyState
    v-if="rows.length && !shown.length"
    v-bind="EMPTY[view]"
  />
  <UiDataTable
    v-else-if="shown.length"
    :columns="columns"
    :rows="shown"
    row-key="id"
    :row-class="rowClass"
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
        <span
          v-if="stockNotes.get(row.id)?.text"
          :class="['stock', stockNotes.get(row.id)?.tone]"
        >{{ stockNotes.get(row.id)?.text }}</span>
        <span
          v-if="row.status === 'cancelled' && row.cancel_reason"
          class="note"
        >السبب: {{ row.cancel_reason }}</span>
      </div>
    </template>
    <template #date="{ row }">
      <bdi
        dir="ltr"
        class="date"
      >{{ deliveryDate(row.created_at) }}</bdi>
    </template>
    <template #state="{ row }">
      <div class="st">
        <UBadge
          :label="statusMeta(row.status).label"
          :color="statusMeta(row.status).color"
          :variant="row.status === 'open' ? 'solid' : 'soft'"
        />
        <bdi
          v-if="row.status === 'ready' && row.notified_at"
          dir="ltr"
          class="st-when"
        >{{ deliveryDate(row.notified_at) }}</bdi>
      </div>
    </template>
    <template #actions="{ row }">
      <BookletsRequestActions
        v-if="canClose"
        :row="row"
        :busy="busy"
        @chat="emit('chat', row)"
        @ready="emit('ready', row.id)"
        @deliver="toDeliver = row"
        @cancel="toCancel = row"
      />
    </template>
    <template #card="{ row, index }">
      <UiCardRow
        :title="row.halaqa?.teacher?.full_name ?? '—'"
        :subtitle="row.halaqa?.name ?? ''"
        :fields="[
          { label: 'الطلب', value: summary(row) },
          ...(row.note ? [{ label: 'ملاحظة', value: row.note }] : []),
          ...(stockNotes.get(row.id)?.text ? [{ label: 'المخزون', value: stockNotes.get(row.id)!.text! }] : []),
          ...(row.cancel_reason ? [{ label: 'سبب الإلغاء', value: row.cancel_reason }] : []),
          { label: 'التاريخ', value: deliveryDate(row.created_at) }
        ]"
        :class="rowClass(row)"
      >
        <template #lead>
          <span class="seq-n">{{ index + 1 }}</span>
        </template>
        <template #badge>
          <UBadge
            :label="statusMeta(row.status).label"
            :color="statusMeta(row.status).color"
            :variant="row.status === 'open' ? 'solid' : 'soft'"
          />
        </template>
        <template
          v-if="canClose"
          #actions
        >
          <BookletsRequestActions
            :row="row"
            :busy="busy"
            block
            @chat="emit('chat', row)"
            @ready="emit('ready', row.id)"
            @deliver="toDeliver = row"
            @cancel="toCancel = row"
          />
        </template>
      </UiCardRow>
    </template>
  </UiDataTable>

  <BookletsDeliverConfirm
    :open="!!toDeliver"
    :teacher="toDeliver?.halaqa?.teacher?.full_name ?? 'المعلّم'"
    :halaqa="toDeliver?.halaqa?.name ?? ''"
    :summary="summary(toDeliver)"
    :busy="busy"
    @update:open="(v: boolean) => { if (!v) toDeliver = null }"
    @confirm="confirmDeliver"
  />
  <BookletsCancelModal
    :open="!!toCancel"
    :summary="`${toCancel?.halaqa?.teacher?.full_name ?? ''} — ${summary(toCancel)}`"
    :busy="busy"
    by-admin
    @update:open="(v: boolean) => { if (!v) toCancel = null }"
    @confirm="confirmCancel"
  />
</template>

<style scoped>
.req-view { margin-bottom: 14px; }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.who { display: flex; flex-direction: column; line-height: 1.45; min-width: 180px; }
.who b { color: var(--ink); font-weight: 600; white-space: nowrap; }
.who span { font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.req { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.chip { padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; white-space: nowrap; }
.chip b { color: var(--blue-ink); font-variant-numeric: tabular-nums; }
.note { font-size: 13px; color: var(--ink-2); }
.stock { font-size: 12.5px; font-weight: 600; }
.stock.bad { color: var(--ui-error); }
.stock.warn { color: var(--ui-warning); }
.st { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
.st-when { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.date { color: var(--ink-2); font-size: 14px; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* الجديدُ بلون شارته، والمُبلَغُ بلونٍ آخر: يُرى من بعيد من تواصلتَ معه */
:deep(.is-new) { background: color-mix(in srgb, var(--ui-warning) 7%, transparent); }
:deep(.is-ready) { background: color-mix(in srgb, var(--ui-info) 9%, transparent); }
@container dt (max-width: 899px) {
  :deep(.col-date) { display: none; }
}
</style>
