<script setup lang="ts">
/**
 * سجلّ الحركات المالية (§4.20ب) — جدول بالرصيد المحسوب + إضافة/تعديل/حذف + فلاتر،
 * ومستنداتُ كلّ حركة (فواتير وإيصالات — ROADMAP #17) بفلتر «مصروفاتٌ بلا مستند» للتدقيق.
 */
import { PROJECT_START_DATE } from '~/constants/project'
import type { Database } from '~/types/database.types'
import type { DocsTransaction } from '~/components/finance/TransactionDocsModal.vue'
import { FINANCE_DOCS_BUCKET } from '~/constants/financeDocs'

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { isReadOnly } = usePermissions()
const { handle } = useErrorHandler()
const { exportXlsx } = useExport()
const toast = useToast()

const CATEGORIES = ['رواتب', 'حوافز', 'تشغيل', 'تبرعات', 'أخرى']
const categoryItems = CATEGORIES.map(c => ({ label: c, value: c }))

type Tx = {
  id: string
  transaction_date: string
  description: string | null
  category: string | null
  type: 'income' | 'expense'
  amount: number
  source_key: string | null
  docs: { count: number }[]
}

const { data: txs, refresh, pending } = await useAsyncData<Tx[]>('fin-txs', async () => {
  const { data } = await supabase
    .from('financial_transactions')
    .select('id, transaction_date, description, category, type, amount, source_key, docs:transaction_attachments(count)')
    .order('transaction_date', { ascending: true }).order('created_at', { ascending: true })
    .returns<Tx[]>()
  return data ?? []
}, { server: false, default: () => [] })

// الرصيد التراكمي ثم العرض من الأحدث
const typeF = ref<'all' | 'income' | 'expense'>('all')
const catF = ref<string>('all')
const rowsWithBalance = computed(() => {
  let bal = 0
  const list = (txs.value ?? []).map((t) => {
    bal += t.type === 'income' ? t.amount : -t.amount
    return { ...t, balance: bal }
  })
  return list.reverse()
})
const docCount = (t: Tx) => t.docs?.[0]?.count ?? 0
/** مصروفٌ يدويّ بلا مستند — المُرحَّل آلياً (رواتب/حوافز بمفتاح مصدر) لا فاتورة له. */
const missingDoc = (t: Tx) => t.type === 'expense' && !t.source_key && docCount(t) === 0
const docF = ref<'all' | 'missing'>('all')
const filtered = computed(() => rowsWithBalance.value.filter(t =>
  (typeF.value === 'all' || t.type === typeF.value) && (catF.value === 'all' || t.category === catF.value)
  && (docF.value === 'all' || missingDoc(t))))

const docsOpen = ref(false)
const docsTx = ref<DocsTransaction | null>(null)
function openDocs(t: Tx) {
  docsTx.value = t
  docsOpen.value = true
}

const totalIncome = computed(() => (txs.value ?? []).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
const totalExpense = computed(() => (txs.value ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
const balance = computed(() => totalIncome.value - totalExpense.value)

// إضافة/تعديل
const today = new Date().toISOString().slice(0, 10)
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = reactive({ transaction_date: today, description: '', category: 'تشغيل', type: 'expense' as 'income' | 'expense', amount: '' })

function openCreate() {
  editingId.value = null
  Object.assign(form, { transaction_date: today, description: '', category: 'تشغيل', type: 'expense', amount: '' })
  modalOpen.value = true
}
function openEdit(t: Tx) {
  editingId.value = t.id
  Object.assign(form, { transaction_date: t.transaction_date, description: t.description ?? '', category: t.category ?? 'تشغيل', type: t.type, amount: String(t.amount) })
  modalOpen.value = true
}

async function save() {
  const amt = Number(form.amount)
  if (!Number.isFinite(amt) || amt <= 0) {
    toast.add({ title: 'أدخل مبلغاً صحيحاً.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    const payload = { transaction_date: form.transaction_date, description: form.description.trim() || null, category: form.category, type: form.type, amount: amt }
    if (editingId.value) {
      const { error } = await supabase.from('financial_transactions').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('financial_transactions').insert({ ...payload, created_by: profile.value?.id ?? null })
      if (error) throw error
    }
    toast.add({ title: 'حُفظت الحركة.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

const deleteTarget = ref<Tx | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    // صفوفُ المستندات تُحذف بالتتالي في القاعدة، وملفّاتُها تُمسح من المستودع بعدها فلا تبقى يتيمة
    const { data: docs } = await supabase.from('transaction_attachments').select('storage_path').eq('transaction_id', deleteTarget.value.id)
    const { error } = await supabase.from('financial_transactions').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    const paths = (docs ?? []).map(d => d.storage_path)
    if (paths.length) await supabase.storage.from(FINANCE_DOCS_BUCKET).remove(paths)
    toast.add({ title: 'حُذفت الحركة.', color: 'success', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    deleting.value = false
  }
}

const fmt = (n: number) => n.toLocaleString('ar')
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' })

const exporting = ref(false)
async function doExport() {
  exporting.value = true
  try {
    const headers = ['التاريخ', 'البيان', 'التصنيف', 'النوع', 'المبلغ', 'الرصيد']
    const data = filtered.value.map(t => [
      t.transaction_date,
      t.description ?? '',
      t.category ?? '',
      t.type === 'income' ? 'وارد' : 'صادر',
      t.amount,
      t.balance
    ])
    await exportXlsx(`الحركات-المالية-${new Date().toISOString().slice(0, 10)}`, headers, data, 'الحركات')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <div class="bar">
      <div class="filters">
        <USelect
          v-model="typeF"
          :items="[{ label: 'كل الأنواع', value: 'all' }, { label: 'وارد', value: 'income' }, { label: 'صادر', value: 'expense' }]"
          size="md"
          :ui="{ base: 'rounded-[11px]' }"
        />
        <USelect
          v-model="catF"
          :items="[{ label: 'كل التصنيفات', value: 'all' }, ...categoryItems]"
          size="md"
          :ui="{ base: 'rounded-[11px]' }"
        />
        <USelect
          v-model="docF"
          :items="[{ label: 'كل المستندات', value: 'all' }, { label: 'مصروفات بلا مستند', value: 'missing' }]"
          size="md"
          :ui="{ base: 'rounded-[11px]' }"
        />
      </div>
      <div class="bar-actions">
        <UButton
          label="تصدير Excel"
          color="neutral"
          variant="outline"
          size="md"
          icon="i-lucide-download"
          :disabled="!filtered.length"
          :loading="exporting"
          :ui="{ base: 'rounded-[12px]' }"
          @click="doExport"
        />
        <UButton
          v-if="!isReadOnly"
          label="حركة جديدة"
          color="primary"
          size="md"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[12px] font-semibold' }"
          @click="openCreate"
        />
      </div>
    </div>

    <ClientOnly>
      <UiEmptyState
        v-if="pending"
        title="جارٍ التحميل…"
      />
      <UiEmptyState
        v-else-if="!filtered.length"
        icon="i-lucide-receipt"
        title="لا حركات"
        description="أضِف أول حركة مالية."
      />
      <div
        v-else
        class="table-wrap stack-wrap"
      >
        <table>
          <thead>
            <tr>
              <th class="ta-start">
                #
              </th>
              <th class="ta-start">
                التاريخ
              </th>
              <th class="ta-start">
                البيان
              </th>
              <th>التصنيف</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>الرصيد</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(t, i) in filtered"
              :key="t.id"
            >
              <td class="ta-start muted stack-hide">
                {{ i + 1 }}
              </td>
              <td
                class="ta-start nowrap"
                data-label="التاريخ"
              >
                {{ fmtDate(t.transaction_date) }}
              </td>
              <td
                class="ta-start strong-sm"
                data-label="البيان"
              >
                {{ t.description || '—' }}
              </td>
              <td data-label="التصنيف">
                <UBadge
                  :label="t.category || '—'"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  class="stack-keep"
                />
              </td>
              <td data-label="النوع">
                <span :class="t.type === 'income' ? 'in' : 'out'">{{ t.type === 'income' ? 'وارد' : 'صادر' }}</span>
              </td>
              <td
                class="num"
                :class="t.type === 'income' ? 'in' : 'out'"
                data-label="المبلغ"
              >
                {{ t.type === 'income' ? '+' : '−' }}{{ fmt(t.amount) }}
              </td>
              <td
                class="num strong"
                data-label="الرصيد"
              >
                {{ fmt(t.balance) }}
              </td>
              <td>
                <div class="rowact stack-keep">
                  <UButton
                    :color="missingDoc(t) ? 'warning' : 'neutral'"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-paperclip"
                    :label="docCount(t) ? String(docCount(t)) : undefined"
                    :aria-label="missingDoc(t) ? 'مصروفٌ بلا مستند — المستندات' : `المستندات (${docCount(t)})`"
                    :title="missingDoc(t) ? 'بلا مستند' : 'المستندات'"
                    @click="openDocs(t)"
                  />
                  <template v-if="!isReadOnly">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-pencil"
                      aria-label="تعديل"
                      @click="openEdit(t)"
                    />
                    <UButton
                      color="error"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-trash-2"
                      aria-label="حذف"
                      @click="deleteTarget = t"
                    />
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td
                colspan="5"
                class="ta-start strong"
              >
                الإجمالي
              </td>
              <td class="num">
                <span class="in">+{{ fmt(totalIncome) }}</span> / <span class="out">−{{ fmt(totalExpense) }}</span>
              </td>
              <td class="num strong">
                {{ fmt(balance) }}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </ClientOnly>

    <UModal
      v-model:open="modalOpen"
      :title="editingId ? 'تعديل حركة' : 'حركة جديدة'"
    >
      <template #body>
        <div class="form">
          <div class="row">
            <UFormField
              label="النوع"
              class="f1"
            >
              <USelect
                v-model="form.type"
                :items="[{ label: 'وارد', value: 'income' }, { label: 'صادر', value: 'expense' }]"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="المبلغ (₪)"
              class="f1"
            >
              <UInput
                v-model="form.amount"
                type="number"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="التصنيف"
              class="f1"
            >
              <UiSelect
                v-model="form.category"
                :items="categoryItems"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="التاريخ"
              class="f1"
            >
              <UInput
                v-model="form.transaction_date"
                type="date"
                :min="PROJECT_START_DATE"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField label="البيان">
            <UInput
              v-model="form.description"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="foot">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            @click="modalOpen = false"
          />
          <UButton
            :label="editingId ? 'حفظ' : 'إضافة'"
            color="primary"
            icon="i-lucide-check"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
      </template>
    </UModal>

    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف الحركة"
      :message="`ستُحذف الحركة «${deleteTarget?.description || ''}» نهائيّاً.`"
      :loading="deleting"
      @confirm="confirmDelete"
      @update:open="(v) => { if (!v) deleteTarget = null }"
    />

    <FinanceTransactionDocsModal
      v-model:open="docsOpen"
      :transaction="docsTx"
      :can-edit="!isReadOnly"
      @changed="refresh"
    />
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.bar-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 720px; }
thead tr, tfoot tr { background: var(--surface-2); }
th { padding: 12px 12px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; white-space: nowrap; text-align: center; }
th.ta-start { text-align: start; }
td { padding: 11px 12px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
.ta-start { text-align: start; }
.nowrap { white-space: nowrap; }
.muted { color: var(--ink-2); }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.strong { font-weight: 700; color: var(--ink); }
.in { color: var(--green-ink); font-weight: 600; }
.out { color: var(--err); font-weight: 600; }
.rowact { display: flex; gap: 2px; justify-content: center; }
.form { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 14px; }
.f1 { flex: 1; }
.foot { display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 560px) { .row { flex-direction: column; } }
</style>
