<script setup lang="ts">
/**
 * مجموعةُ موظفٍ واحد في «كلّ الرحلات»: رأسٌ بالاسم والمجموع وغير المسدَّد، ثم رحلاتُه
 * (جدولٌ على سطح المكتب وبطاقاتٌ على الجوال). للمدير الإداري (`canPay`) مفتاحُ «مسدَّدة» لكل رحلة؛
 * ولمشرف المشروع شارةٌ نصّيةٌ بلا مفتاح. المفتاحُ يُعطَّل ما دام طلبُه جارياً (`busyIds`)،
 * والتحديثُ المتفائل وإرجاعُه عند الخطأ في المكوّن الأب.
 */
import { formatDay } from '~/utils/reportWindow'
import { formatAmount, isolateLtr, type Trip } from '~/utils/transport'

const props = defineProps<{
  name: string
  total: number
  unpaidTotal: number
  trips: (Trip & { serial: number })[]
  canPay: boolean
  /** معرّفاتُ الرحلات التي طلبُ تسديدها جارٍ. */
  busyIds: string[]
}>()

const emit = defineEmits<{ toggle: [id: string, paid: boolean] }>()

/** صفُّ العرض: الرحلةُ بنصوصها المنسّقة. */
type Row = {
  id: string
  serial: number
  date: string
  description: string
  amountText: string
  notes: string
  paid: boolean
  busy: boolean
  switchLabel: string
}

const rows = computed<Row[]>(() => props.trips.map((t) => {
  const date = formatDay(t.trip_date)
  return {
    id: t.id,
    serial: t.serial,
    date,
    description: t.description,
    amountText: formatAmount(t.amount),
    notes: t.notes ?? '',
    paid: t.paid,
    busy: props.busyIds.includes(t.id),
    switchLabel: `مسدَّدة: ${t.description} ${date}`
  }
}))

const columns = [
  { key: 'serial', label: '#' },
  { key: 'date', label: 'التاريخ' },
  { key: 'description', label: 'البيان' },
  { key: 'amount', label: 'المبلغ' },
  { key: 'notes', label: 'الملاحظات' },
  { key: 'paid', label: 'مسدَّدة', align: 'end' as const }
]

const totalText = computed(() => formatAmount(props.total))
const unpaidText = computed(() => formatAmount(props.unpaidTotal))
</script>

<template>
  <section class="group">
    <header class="ghead">
      <h3 class="gname">
        {{ name }}
      </h3>
      <p class="gsums">
        <span>المجموع: <bdi
          class="num"
          dir="ltr"
        >{{ totalText }}</bdi></span>
        <span
          class="dot"
          aria-hidden="true"
        >·</span>
        <span>غير المسدَّد: <bdi
          class="num"
          dir="ltr"
        >{{ unpaidText }}</bdi></span>
      </p>
    </header>

    <UiDataTable
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
      <template #paid="{ row }">
        <div class="paidcell">
          <USwitch
            v-if="canPay"
            :model-value="row.paid"
            :disabled="row.busy"
            :aria-label="row.switchLabel"
            @update:model-value="(v: boolean) => emit('toggle', row.id, v)"
          />
          <span
            v-else
            class="badge"
            :class="row.paid ? 'paid' : 'unpaid'"
          >{{ row.paid ? 'مسدَّدة' : 'غير مسدَّدة' }}</span>
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
          <template
            v-if="!canPay"
            #badge
          >
            <span
              class="badge"
              :class="row.paid ? 'paid' : 'unpaid'"
            >{{ row.paid ? 'مسدَّدة' : 'غير مسدَّدة' }}</span>
          </template>
          <template
            v-if="canPay"
            #actions
          >
            <div class="cardpay">
              <span class="cardpay-label">مسدَّدة</span>
              <USwitch
                :model-value="row.paid"
                :disabled="row.busy"
                :aria-label="row.switchLabel"
                @update:model-value="(v: boolean) => emit('toggle', row.id, v)"
              />
            </div>
          </template>
        </UiCardRow>
      </template>
    </UiDataTable>
  </section>
</template>

<style scoped>
.group { display: flex; flex-direction: column; gap: 10px; }
.ghead { display: flex; align-items: baseline; justify-content: space-between; gap: 6px 16px; flex-wrap: wrap; }
.gname { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.gsums { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; font-size: 14.5px; color: var(--ink-2); }
.gsums .num { color: var(--ink); font-weight: 700; }
.dot { color: var(--ink-3); }
.num { font-variant-numeric: tabular-nums; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.paidcell { display: flex; justify-content: flex-end; align-items: center; min-height: 44px; }
.badge { display: inline-flex; align-items: center; height: 26px; padding: 0 11px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; }
.badge.paid { background: var(--green-soft); color: var(--green-ink); }
.badge.unpaid { background: var(--surface-2); color: var(--ink-2); }
.serial { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; font-weight: 600; }
.cardpay { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 44px; }
.cardpay-label { font-size: 14px; color: var(--ink-2); }
</style>
