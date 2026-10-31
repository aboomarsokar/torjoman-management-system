<script setup lang="ts">
/**
 * «طلباتي» في صفحة الملازم عند المعلّم (طلب المستخدم 2026-10-25)، بأربع حالات (2026-10-31): بانتظار التجهيز ·
 * جاهزةٌ للاستلام (أبلغه المدير) · تمّ التسليم · ملغى بسببه. ويعدّل طلبَه ويلغيه ما لم يُسلَّم.
 */
import { BOOKLETS } from '~/constants/booklets'
import { requestError, type BookletRequest, type RequestDraft } from '~/composables/useBookletRequests'
import { deliveryDate } from '~/utils/booklets'
import { isPendingRequest, statusMeta, TEACHER_STATUS, type RequestStatus } from '~/utils/bookletRequests'

defineProps<{ rows: BookletRequest[], busy: boolean }>()
const emit = defineEmits<{ edit: [id: string, draft: RequestDraft], cancel: [id: string, reason: string] }>()

const label = (n: number) => BOOKLETS.find(b => b.no === n)?.label ?? `الملزمة ${n}`
const stateLabel = (s: string) => TEACHER_STATUS[s as RequestStatus] ?? TEACHER_STATUS.open

const editing = ref<BookletRequest | null>(null)
const editDraft = computed<RequestDraft | null>(() => editing.value
  ? { booklet: editing.value.booklet, copies: String(editing.value.copies), note: editing.value.note ?? '' }
  : null)
const cancelling = ref<BookletRequest | null>(null)

const toast = useToast()
/** خطأُ النموذج يُبقي المربّعَ مفتوحاً؛ وإلا يُرسَل التعديلُ ويُغلق (وخطأُ القاعدة رسالةٌ عائمة). */
function saveEdit(d: RequestDraft) {
  const problem = requestError(d)
  if (problem) {
    toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
    return
  }
  if (editing.value) emit('edit', editing.value.id, d)
  editing.value = null
}
function confirmCancel(reason: string) {
  if (cancelling.value) emit('cancel', cancelling.value.id, reason)
  cancelling.value = null
}

const columns = [
  { key: 'num', label: '#' },
  { key: 'booklet', label: 'الملزمة' },
  { key: 'copies', label: 'النسخ', align: 'center' as const },
  { key: 'date', label: 'تاريخ الطلب' },
  { key: 'state', label: 'الحالة' },
  { key: 'actions', label: '', align: 'end' as const }
]
</script>

<template>
  <UiEmptyState
    v-if="!rows.length"
    icon="i-lucide-send"
    title="لا طلباتِ ملازم بعد"
    description="اطلب ما تحتاجه حلقتُك بزرّ «اطلب ملازم» فيصل طلبُك إلى المدير الإداري."
  />
  <UiDataTable
    v-else
    :columns="columns"
    :rows="rows"
    row-key="id"
    :row-class="(r: BookletRequest) => r.status === 'ready' ? 'is-ready' : undefined"
  >
    <template #num="{ index }">
      <span class="seq-n">{{ index + 1 }}</span>
    </template>
    <template #booklet="{ row }">
      <div class="bk-cell">
        <span class="bk">{{ label(row.booklet) }}</span>
        <span
          v-if="row.status === 'cancelled' && row.cancel_reason"
          class="why"
        >السبب: {{ row.cancel_reason }}</span>
      </div>
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
        :label="stateLabel(row.status)"
        :color="statusMeta(row.status).color"
        variant="soft"
      />
    </template>
    <template #actions="{ row }">
      <div
        v-if="isPendingRequest(row.status)"
        class="acts"
      >
        <UButton
          label="تعديل"
          icon="i-lucide-pencil"
          color="neutral"
          variant="soft"
          :ui="{ base: 'rounded-[11px] min-h-10 px-3' }"
          @click="editing = row"
        />
        <UButton
          label="إلغاء"
          icon="i-lucide-x"
          color="error"
          variant="ghost"
          :ui="{ base: 'rounded-[11px] min-h-10 px-3' }"
          @click="cancelling = row"
        />
      </div>
    </template>
    <template #card="{ row, index }">
      <UiCardRow
        :title="label(row.booklet)"
        :subtitle="deliveryDate(row.created_at)"
        :fields="[{ label: 'النسخ', value: String(row.copies) }, ...(row.cancel_reason ? [{ label: 'سبب الإلغاء', value: row.cancel_reason }] : [])]"
        :class="row.status === 'ready' ? 'is-ready' : undefined"
      >
        <template #lead>
          <span class="seq-n">{{ index + 1 }}</span>
        </template>
        <template #badge>
          <UBadge
            :label="stateLabel(row.status)"
            :color="statusMeta(row.status).color"
            variant="soft"
          />
        </template>
        <template
          v-if="isPendingRequest(row.status)"
          #actions
        >
          <div class="acts acts-block">
            <UButton
              label="تعديل"
              icon="i-lucide-pencil"
              color="neutral"
              variant="soft"
              block
              :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
              @click="editing = row"
            />
            <UButton
              label="إلغاء"
              icon="i-lucide-x"
              color="error"
              variant="soft"
              block
              :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
              @click="cancelling = row"
            />
          </div>
        </template>
      </UiCardRow>
    </template>
  </UiDataTable>

  <BookletsRequestModal
    :open="!!editing"
    :initial="editDraft"
    :busy="busy"
    @update:open="(v: boolean) => { if (!v) editing = null }"
    @save="saveEdit"
  />
  <BookletsCancelModal
    :open="!!cancelling"
    :summary="cancelling ? `${label(cancelling.booklet)} × ${cancelling.copies}` : ''"
    :busy="busy"
    @update:open="(v: boolean) => { if (!v) cancelling = null }"
    @confirm="confirmCancel"
  />
</template>

<style scoped>
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.bk-cell { display: flex; flex-direction: column; gap: 2px; }
.bk { color: var(--ink); font-weight: 600; white-space: nowrap; }
.why { font-size: 13px; color: var(--ink-2); }
.n { font-size: 16px; color: var(--ink); font-variant-numeric: tabular-nums; }
.date { color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.acts { display: flex; gap: 8px; justify-content: flex-end; }
.acts-block { width: 100%; }
:deep(.is-ready) { background: color-mix(in srgb, var(--ui-info) 9%, transparent); }
</style>
