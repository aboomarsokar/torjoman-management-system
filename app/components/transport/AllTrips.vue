<script setup lang="ts">
/**
 * «كلّ الرحلات»: رحلاتُ الشهر كلُّها مجمَّعةً بالموظف. المدير الإداري يسدّد رحلةً بمفتاحها
 * (تحديثٌ متفائلٌ يُرجَع عند الخطأ) أو يسدّد غيرَ المسدَّد في العرض الحاليّ بـ«تسديد الكل»
 * بعد أن تُعاد قراءةُ الشهر فيُحسب العددُ والمبلغ من البيانات الطازجة لا من نسخةٍ قديمة؛
 * ومشرف المشروع يقرأ فقط. الحكمُ لـRLS ودالّة `set_transport_paid`؛ هذا طبقةُ تجربة.
 */
import { periodLabel } from '~/utils/reportWindow'
import { formatAmount, groupByEmployee, payAllText, sumAmount, unpaid, type Trip } from '~/utils/transport'

const props = defineProps<{ year: number, month: number }>()

const { fetchMonth, fetchLoggers, setPaid } = useTransport()
const { handle } = useErrorHandler()
const { isAdmin } = usePermissions()
const toast = useToast()

// المفتاحُ التفاعليّ وحده يعيد الجلب عند تغيّر الشهر (بلا `watch` فيتكرّر الطلب)
const { data: trips, pending } = useLazyAsyncData<Trip[]>(
  () => `transport-all-${props.year}-${props.month}`,
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

const { data: loggers } = useLazyAsyncData<{ id: string, full_name: string }[]>(
  'transport-loggers',
  async () => {
    try {
      return await fetchLoggers()
    } catch (err) {
      handle(err)
      return []
    }
  },
  { server: false, default: () => [] }
)

const names = computed<Record<string, string>>(() => Object.fromEntries((loggers.value ?? []).map(l => [l.id, l.full_name])))
const ALL = 'all'
const selected = ref<string>(ALL)
const employeeItems = computed(() => [
  { label: 'كلّ الموظفين', value: ALL },
  ...(loggers.value ?? []).map(l => ({ label: l.full_name, value: l.id }))
])

const label = computed(() => periodLabel(props.year, props.month))
const visible = computed(() => selected.value === ALL ? (trips.value ?? []) : (trips.value ?? []).filter(t => t.profile_id === selected.value))
const groups = computed(() => groupByEmployee(visible.value, names.value))
const unpaidVisible = computed(() => unpaid(visible.value))
const total = computed(() => formatAmount(sumAmount(visible.value)))
const unpaidTotal = computed(() => formatAmount(sumAmount(unpaidVisible.value)))

/** لفظُ عدد الموظفين بالعربية: مفرد، ومثنّى، وجمع. */
const employeesText = computed(() => {
  const n = groups.value.length
  if (n === 1) return 'موظف واحد'
  if (n === 2) return 'موظفان'
  return n <= 10 ? `${n} موظفين` : `${n} موظفاً`
})

const skeletonColumns = [
  { key: 'serial', label: '#' },
  { key: 'date', label: 'التاريخ' },
  { key: 'description', label: 'البيان' },
  { key: 'amount', label: 'المبلغ' },
  { key: 'notes', label: 'الملاحظات' },
  { key: 'paid', label: 'مسدَّدة' }
]

// ---- مفتاحُ التسديد: متفائلٌ، معطَّلٌ ما دام طلبُه جارياً، ويُرجَع عند الخطأ ----
const busyIds = ref<string[]>([])

/** يبدّل `paid` لرحلةٍ بعينها دون المساس بغيرها (لا يُستبدل الشهرُ كلُّه فلا يُمحى تبديلٌ متزامن). */
function setLocalPaid(id: string, paid: boolean) {
  trips.value = (trips.value ?? []).map(t => t.id === id ? { ...t, paid } : t)
}

async function toggle(id: string, paid: boolean) {
  if (busyIds.value.includes(id)) return
  const before = (trips.value ?? []).find(t => t.id === id)?.paid ?? !paid
  busyIds.value = [...busyIds.value, id]
  setLocalPaid(id, paid)
  try {
    const changed = await setPaid([id], paid)
    if (!changed) await refreshTrips() // لم يتغيّر شيء: حالتُها في القاعدة غيرُ ما ظنّته الشاشة
  } catch (err) {
    setLocalPaid(id, before)
    handle(err)
  } finally {
    busyIds.value = busyIds.value.filter(x => x !== id)
  }
}

// ---- «تسديد الكل»: يُعاد قراءةُ الشهر ثم يُحسب ما يُعرض في التأكيد من الطازج ----
const checking = ref(false)
const paying = ref(false)
const confirmOpen = ref(false)
const confirmIds = ref<string[]>([])
const confirmMessage = ref('')

async function askPayAll() {
  checking.value = true
  try {
    const fresh = await fetchMonth(props.year, props.month)
    trips.value = fresh
    const list = unpaid(selected.value === ALL ? fresh : fresh.filter(t => t.profile_id === selected.value))
    if (!list.length) {
      toast.add({ title: 'لا رحلات غير مسدَّدة.', color: 'info', icon: 'i-lucide-info' })
      return
    }
    confirmIds.value = list.map(t => t.id)
    const who = selected.value === ALL ? '' : `${names.value[selected.value] ?? ''}: `
    confirmMessage.value = `${who}${payAllText(list)}`
    confirmOpen.value = true
  } catch (err) {
    handle(err)
  } finally {
    checking.value = false
  }
}

async function confirmPayAll() {
  paying.value = true
  try {
    const n = await setPaid(confirmIds.value, true)
    toast.add({ title: `سُدّدت ${n} رحلة.`, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    handle(err)
  } finally {
    paying.value = false
    confirmOpen.value = false
    await refreshTrips()
  }
}

/** إعادةُ قراءة الشهر بعد التسديد؛ الفشلُ يُبلَّغ ولا يمحو ما على الشاشة. */
async function refreshTrips() {
  try {
    trips.value = await fetchMonth(props.year, props.month)
  } catch (err) {
    handle(err)
  }
}
</script>

<template>
  <div class="all">
    <div class="card top">
      <div class="controls">
        <div class="field">
          <label
            class="flabel"
            for="transport-employee"
          >الموظف</label>
          <UiSelect
            id="transport-employee"
            v-model="selected"
            :items="employeeItems"
            size="lg"
            :ui="{ base: 'rounded-[13px] min-h-11' }"
          />
        </div>
        <div
          v-if="isAdmin"
          class="payall"
          :title="unpaidVisible.length ? undefined : 'لا رحلات غير مسدَّدة'"
        >
          <UButton
            label="تسديد الكل"
            icon="i-lucide-check-check"
            color="primary"
            size="lg"
            :loading="checking"
            :disabled="!unpaidVisible.length"
            :ui="{ base: 'rounded-[13px] min-h-11 font-semibold justify-center' }"
            class="payall-btn"
            @click="askPayAll"
          />
        </div>
      </div>
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
        <span
          class="dot"
          aria-hidden="true"
        >·</span>
        <span>{{ employeesText }}</span>
      </p>
    </div>

    <UiSkeletonTable
      v-if="pending && !groups.length"
      :columns="skeletonColumns"
    />
    <UiEmptyState
      v-else-if="!groups.length"
      icon="i-lucide-bus"
      :title="selected === ALL ? `لا رحلات في ${label}` : `لا رحلات لهذا الموظف في ${label}`"
    />
    <template v-else>
      <TransportEmployeeGroup
        v-for="g in groups"
        :key="g.profileId"
        :name="g.name"
        :total="g.total"
        :unpaid-total="g.unpaidTotal"
        :trips="g.trips"
        :can-pay="isAdmin"
        :busy-ids="busyIds"
        @toggle="toggle"
      />
    </template>

    <UiConfirmModal
      v-model:open="confirmOpen"
      title="تسديد الكل"
      :message="confirmMessage"
      confirm-label="تسديد"
      confirm-color="primary"
      confirm-icon="i-lucide-check-check"
      :loading="paying"
      @confirm="confirmPayAll"
    />
  </div>
</template>

<style scoped>
.all { display: flex; flex-direction: column; gap: 20px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.top { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; }
.controls { display: flex; align-items: flex-end; gap: 12px 16px; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 8px; width: min(100%, 300px); }
.flabel { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.payall { flex: none; }
.sums { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-size: 16px; color: var(--ink-2); }
.sums .num { color: var(--ink); font-weight: 700; }
.dot { color: var(--ink-3); }
.num { font-variant-numeric: tabular-nums; }
@media (max-width: 560px) {
  /* نصفُ السطر للتصفية ونصفُه لـ«تسديد الكل» */
  .controls { display: grid; grid-template-columns: 1fr 1fr; }
  .field { width: auto; }
  .payall-btn { width: 100%; }
}
</style>
