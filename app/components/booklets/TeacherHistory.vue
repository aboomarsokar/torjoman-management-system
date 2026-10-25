<script setup lang="ts">
/**
 * صفحةُ «الملازم» للمعلّم بجداول (طلب المستخدم 2026-10-25 «على شكل جدول»): سطرُ خلاصةٍ (مجموعُ النسخ وعددُ
 * الملازم وزرُّ الطلب)، ثم جدولُ التسليمات تسليماً تسليماً (الملزمة والنسخ والتاريخ والملاحظة)، ثم جدولُ طلباته
 * بحالتها. والبطاقةُ المختصرة تبقى في لوحته (`DashboardTeacherBooklets`).
 */
import { BOOKLETS } from '~/constants/booklets'
import type { RequestDraft } from '~/composables/useBookletRequests'
import { deliveryDate, type DeliveryRow } from '~/utils/booklets'

const props = defineProps<{ halaqaId: string }>()

const supabase = useSupabaseClient()
const { data: deliveries, pending } = useLazyAsyncData<DeliveryRow[]>(`teacher-history-${props.halaqaId}`, async () => {
  const { data, error } = await supabase.from('booklet_deliveries')
    .select('id, halaqa_id, booklet, copies, delivered_on, note').eq('halaqa_id', props.halaqaId)
    .order('delivered_on', { ascending: false }).order('created_at', { ascending: false })
    .returns<DeliveryRow[]>()
  if (error) console.error('[teacher-history] فشل الجلب:', error.message)
  return data ?? []
}, { server: false, default: () => [] })

const { requests, busy, addRequest } = useBookletRequests(props.halaqaId)
const requestOpen = ref(false)
async function sendRequest(d: RequestDraft) {
  if (await addRequest(props.halaqaId, d)) requestOpen.value = false
}

const label = (n: number) => BOOKLETS.find(b => b.no === n)?.label ?? `الملزمة ${n}`
const totalCopies = computed(() => (deliveries.value ?? []).reduce((s, d) => s + d.copies, 0))
const bookletCount = computed(() => new Set((deliveries.value ?? []).map(d => d.booklet)).size)

const deliveryColumns = [
  { key: 'num', label: '#' },
  { key: 'booklet', label: 'الملزمة' },
  { key: 'copies', label: 'النسخ', align: 'center' as const },
  { key: 'date', label: 'تاريخ التسليم' },
  { key: 'note', label: 'ملاحظة', class: 'col-note' }
]
const requestColumns = [
  { key: 'num', label: '#' },
  { key: 'booklet', label: 'الملزمة' },
  { key: 'copies', label: 'النسخ', align: 'center' as const },
  { key: 'date', label: 'تاريخ الطلب' },
  { key: 'state', label: 'الحالة' }
]
</script>

<template>
  <div class="th">
    <div class="th-sum">
      <div class="th-figs">
        <div class="fig">
          <b>{{ totalCopies }}</b><span>نسخةً مستلَمة</span>
        </div>
        <div class="fig">
          <b>{{ bookletCount }}</b><span>من {{ BOOKLETS.length }} ملزمة</span>
        </div>
      </div>
      <UButton
        label="اطلب ملازم"
        icon="i-lucide-send"
        color="primary"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="requestOpen = true"
      />
    </div>

    <h2 class="th-h">
      التسليمات
    </h2>
    <UiSkeletonTable
      v-if="pending && !deliveries?.length"
      :columns="deliveryColumns"
    />
    <UiEmptyState
      v-else-if="!deliveries?.length"
      icon="i-lucide-book-copy"
      title="لم تستلم حلقتُك ملازمَ بعد"
      description="يظهر هنا كلُّ تسليمٍ يسجّله المدير الإداري، ويصلك به إشعار."
    />
    <UiDataTable
      v-else
      :columns="deliveryColumns"
      :rows="deliveries"
      row-key="id"
    >
      <template #num="{ index }">
        <span class="seq-n">{{ index + 1 }}</span>
      </template>
      <template #booklet="{ row }">
        <span class="bk">{{ label(row.booklet) }}</span>
      </template>
      <template #copies="{ row }">
        <b class="n">{{ row.copies }}</b>
      </template>
      <template #date="{ row }">
        <bdi
          dir="ltr"
          class="date"
        >{{ deliveryDate(row.delivered_on) }}</bdi>
      </template>
      <template #note="{ row }">
        <span :class="row.note ? 'note' : 'dash'">{{ row.note || '—' }}</span>
      </template>
      <template #card="{ row, index }">
        <UiCardRow
          :title="label(row.booklet)"
          :subtitle="deliveryDate(row.delivered_on)"
          :fields="[{ label: 'النسخ', value: String(row.copies) }, ...(row.note ? [{ label: 'ملاحظة', value: row.note }] : [])]"
        >
          <template #lead>
            <span class="seq-n">{{ index + 1 }}</span>
          </template>
        </UiCardRow>
      </template>
    </UiDataTable>

    <h2 class="th-h">
      طلباتي
    </h2>
    <UiEmptyState
      v-if="!requests?.length"
      icon="i-lucide-send"
      title="لا طلباتِ ملازم بعد"
      description="اطلب ما تحتاجه حلقتُك بزرّ «اطلب ملازم» فيصل طلبُك إلى المدير الإداري."
    />
    <UiDataTable
      v-else
      :columns="requestColumns"
      :rows="requests"
      row-key="id"
    >
      <template #num="{ index }">
        <span class="seq-n">{{ index + 1 }}</span>
      </template>
      <template #booklet="{ row }">
        <span class="bk">{{ label(row.booklet) }}</span>
      </template>
      <template #copies="{ row }">
        <b class="n">{{ row.copies }}</b>
      </template>
      <template #date="{ row }">
        <bdi
          dir="ltr"
          class="date"
        >{{ deliveryDate(row.created_at) }}</bdi>
      </template>
      <template #state="{ row }">
        <UBadge
          :label="row.status === 'open' ? 'بانتظار التسليم' : 'تمّ التسليم'"
          :color="row.status === 'open' ? 'warning' : 'success'"
          variant="soft"
        />
      </template>
      <template #card="{ row, index }">
        <UiCardRow
          :title="label(row.booklet)"
          :subtitle="deliveryDate(row.created_at)"
          :fields="[{ label: 'النسخ', value: String(row.copies) }]"
        >
          <template #lead>
            <span class="seq-n">{{ index + 1 }}</span>
          </template>
          <template #badge>
            <UBadge
              :label="row.status === 'open' ? 'بانتظار التسليم' : 'تمّ التسليم'"
              :color="row.status === 'open' ? 'warning' : 'success'"
              variant="soft"
            />
          </template>
        </UiCardRow>
      </template>
    </UiDataTable>

    <BookletsRequestModal
      v-model:open="requestOpen"
      :busy="busy"
      @save="sendRequest"
    />
  </div>
</template>

<style scoped>
.th { display: flex; flex-direction: column; gap: 14px; }
.th-sum { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 16px 20px; border-radius: 18px; background: var(--surface); }
.th-figs { display: flex; gap: 28px; }
.fig { display: flex; align-items: baseline; gap: 8px; }
.fig b { font-size: 26px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.fig span { font-size: 14px; color: var(--ink-2); }
.th-h { margin: 10px 0 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.bk { color: var(--ink); font-weight: 600; white-space: nowrap; }
.n { font-size: 16px; color: var(--ink); font-variant-numeric: tabular-nums; }
.date { color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.note { color: var(--ink-2); font-size: 14px; }
.dash { color: var(--ink-3); opacity: .55; }
@container dt (max-width: 700px) {
  :deep(.col-note) { display: none; }
}
</style>
