<script setup lang="ts">
/**
 * «رحلاتي»: رحلاتُ صاحب الحساب في الشهر المعروض (المشرف الميداني أو المختبِر) — إضافةٌ وتعديلٌ وحذفٌ
 * ما دامت غيرَ مسدَّدة (`canEditTrip`)؛ والتسديدُ بيد المدير الإداري فلا زرّ له هنا.
 * جدولٌ على سطح المكتب وبطاقاتٌ على الجوال (`#card`).
 */
import { formatDay, periodLabel } from '~/utils/reportWindow'
import { canEditTrip, formatAmount, isolateLtr, numberTrips, sumAmount, unpaid, type Trip } from '~/utils/transport'

const props = defineProps<{ year: number, month: number }>()

const { fetchMonth, deleteTrip } = useTransport()
const { handle } = useErrorHandler()
const toast = useToast()

const { data: trips, pending, refresh } = useLazyAsyncData<Trip[]>(
  () => `transport-mine-${props.year}-${props.month}`,
  async () => {
    try {
      return await fetchMonth(props.year, props.month)
    } catch (err) {
      handle(err)
      return []
    }
  },
  { server: false, default: () => [] }
)

/** صفُّ العرض: الرحلةُ مرقَّمةً بنصوصها المنسّقة وحقِّ تعديلها. */
type Row = {
  id: string
  serial: number
  date: string
  description: string
  amountText: string
  notes: string
  paid: boolean
  editable: boolean
  trip: Trip
}

const rows = computed<Row[]>(() => numberTrips(trips.value ?? []).map(t => ({
  id: t.id,
  serial: t.serial,
  date: formatDay(t.trip_date),
  description: t.description,
  amountText: formatAmount(t.amount),
  notes: t.notes ?? '',
  paid: t.paid,
  editable: canEditTrip(t, { isOwner: true, isAdmin: false }),
  trip: t
})))

const total = computed(() => formatAmount(sumAmount(trips.value ?? [])))
const unpaidTotal = computed(() => formatAmount(sumAmount(unpaid(trips.value ?? []))))
const label = computed(() => periodLabel(props.year, props.month))

const columns = [
  { key: 'serial', label: '#' },
  { key: 'date', label: 'التاريخ' },
  { key: 'description', label: 'البيان' },
  { key: 'amount', label: 'المبلغ' },
  { key: 'notes', label: 'الملاحظات' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'إجراء', align: 'end' as const }
]

const LOCKED_TITLE = 'سُدّدت فلا تُعدَّل'

const modalOpen = ref(false)
const editing = ref<Trip | null>(null)
function openAdd() {
  editing.value = null
  modalOpen.value = true
}
function openEdit(r: Row) {
  editing.value = r.trip
  modalOpen.value = true
}

const deleteTarget = ref<Row | null>(null)
/** تاريخُ آخر رحلةٍ طُلب حذفُها — يبقى في رسالة النافذة أثناء إغلاقها فلا تومض «حذف رحلة ؟». */
const deleteDate = ref('')
function askDelete(r: Row) {
  deleteDate.value = r.date
  deleteTarget.value = r
}
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: (v: boolean) => {
    if (!v) deleteTarget.value = null
  }
})
const deleting = ref(false)
async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  try {
    await deleteTrip(target.id)
    toast.add({ title: 'حُذفت الرحلة.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    handle(err)
  } finally {
    deleting.value = false
    deleteTarget.value = null
    await refresh()
  }
}
</script>

<template>
  <div class="mine">
    <div class="bar">
      <p class="sums">
        <span>المجموع: <bdi
          class="num"
          dir="ltr"
        >{{ total }}</bdi></span>
        <span
          class="dot"
          aria-hidden="true"
        >·</span>
        <span>غير المسدَّد: <bdi
          class="num"
          dir="ltr"
        >{{ unpaidTotal }}</bdi></span>
      </p>
      <UButton
        label="إضافة رحلة"
        icon="i-lucide-plus"
        color="primary"
        size="lg"
        :ui="{ base: 'rounded-[13px] min-h-11 font-semibold justify-center' }"
        class="add"
        @click="openAdd"
      />
    </div>

    <UiSkeletonTable
      v-if="pending && !rows.length"
      :columns="columns"
    />
    <UiEmptyState
      v-else-if="!rows.length"
      icon="i-lucide-bus"
      :title="`لا رحلات في ${label}`"
      description="أضِف رحلاتك لتظهر للإدارة في كشف الشهر."
    >
      <UButton
        label="إضافة رحلة"
        icon="i-lucide-plus"
        color="primary"
        size="lg"
        :ui="{ base: 'rounded-[13px] min-h-11 font-semibold' }"
        @click="openAdd"
      />
    </UiEmptyState>
    <UiDataTable
      v-else
      :columns="columns"
      :rows="rows"
      row-key="id"
    >
      <template #serial="{ row }">
        <span class="muted num">{{ row.serial }}</span>
      </template>
      <template #date="{ row }">
        <span class="num">{{ row.date }}</span>
      </template>
      <template #description="{ row }">
        <span class="strong">{{ row.description }}</span>
      </template>
      <template #amount="{ row }">
        <bdi
          class="num strong"
          dir="ltr"
        >{{ row.amountText }}</bdi>
      </template>
      <template #notes="{ row }">
        <span class="muted">{{ row.notes || '—' }}</span>
      </template>
      <template #status="{ row }">
        <span
          class="badge"
          :class="row.paid ? 'paid' : 'unpaid'"
        >{{ row.paid ? 'مسدَّدة' : 'غير مسدَّدة' }}</span>
      </template>
      <template #actions="{ row }">
        <div
          class="actions"
          :title="row.editable ? undefined : LOCKED_TITLE"
        >
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
            aria-label="تعديل"
            :disabled="!row.editable"
            :ui="{ base: 'rounded-[10px] min-h-11 min-w-11 justify-center' }"
            @click="openEdit(row)"
          />
          <UButton
            color="error"
            variant="outline"
            icon="i-lucide-trash-2"
            aria-label="حذف"
            :disabled="!row.editable"
            :ui="{ base: 'rounded-[10px] min-h-11 min-w-11 justify-center' }"
            @click="askDelete(row)"
          />
        </div>
      </template>
      <template #card="{ row }">
        <UiCardRow
          :title="row.description"
          :subtitle="row.date"
          :fields="[
            { label: 'المبلغ', value: isolateLtr(row.amountText) },
            { label: 'الملاحظات', value: row.notes }
          ]"
        >
          <template #lead>
            <span class="serial num">{{ row.serial }}</span>
          </template>
          <template #badge>
            <span
              class="badge"
              :class="row.paid ? 'paid' : 'unpaid'"
            >{{ row.paid ? 'مسدَّدة' : 'غير مسدَّدة' }}</span>
          </template>
          <template #actions>
            <template v-if="row.editable">
              <UButton
                label="تعديل"
                color="neutral"
                variant="outline"
                icon="i-lucide-pencil"
                :ui="{ base: 'rounded-[10px]' }"
                @click="openEdit(row)"
              />
              <UButton
                label="حذف"
                color="error"
                variant="outline"
                icon="i-lucide-trash-2"
                :ui="{ base: 'rounded-[10px]' }"
                @click="askDelete(row)"
              />
            </template>
            <p
              v-else
              class="locked"
            >
              {{ LOCKED_TITLE }}
            </p>
          </template>
        </UiCardRow>
      </template>
    </UiDataTable>

    <TransportTripModal
      v-model:open="modalOpen"
      :trip="editing"
      :year="year"
      :month="month"
      @saved="refresh"
    />
    <UiConfirmModal
      v-model:open="deleteOpen"
      title="حذف رحلة"
      :message="`حذف رحلة ${deleteDate}؟`"
      confirm-label="حذف"
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.mine { display: flex; flex-direction: column; gap: 16px; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; flex-wrap: wrap; }
.sums { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-size: 16px; color: var(--ink-2); }
.sums .num { color: var(--ink); font-weight: 700; }
.dot { color: var(--ink-3); }
.add { flex: none; }
.num { font-variant-numeric: tabular-nums; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.badge { display: inline-flex; align-items: center; height: 26px; padding: 0 11px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; }
.badge.paid { background: var(--green-soft); color: var(--green-ink); }
.badge.unpaid { background: var(--surface-2); color: var(--ink-2); }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.serial { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; font-weight: 600; }
.locked { margin: 0; flex: 1 1 100%; font-size: 13.5px; color: var(--ink-3); }
@media (max-width: 560px) {
  .add { width: 100%; }
}
</style>
