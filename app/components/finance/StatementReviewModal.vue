<script setup lang="ts">
/**
 * بنودُ كشف حوافز حلقةٍ واحدة للمراجِع: تاريخُ كلّ مصروفٍ وبيانُه وتصنيفُه ومبلغُه، ثم «تمّ الاطّلاع».
 * كان المراجِع يُقرّ الاطّلاع من جدول المجاميع دون أن يرى بنداً واحداً، فلا توثيقَ يُراجَع فعلاً.
 * و«إعادة إلى المعلّم» (المُرسَل أو المُطّلَع عليه) بملاحظةٍ إلزامية تظهر للمعلّم — عبر `return_statement`.
 */
import type { Database } from '~/types/database.types'

export interface ReviewedStatement { id: string, halaqa: string, received: number, status: string, returnNote: string | null }

interface Props {
  open: boolean
  statement: ReviewedStatement | null
  /** يُظهر «تمّ الاطّلاع» و«إعادة إلى المعلّم» (المدير الإداري، والمديرة الإدارية للبنات). */
  canReview: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [boolean], 'reviewed': [string], 'returned': [string, string] }>()

const MIN_RETURN_NOTE = 3
const returning = ref(false)
const returnNote = ref('')
const returnSaving = ref(false)
const canReturn = computed(() => props.canReview && (props.statement?.status === 'submitted' || props.statement?.status === 'reviewed'))
async function sendBack() {
  if (!props.statement) return
  if (returnNote.value.trim().length < MIN_RETURN_NOTE) {
    toast.add({ title: 'اكتب للمعلّم ما يصحّحه.', color: 'warning', icon: 'i-lucide-info' })
    return
  }
  returnSaving.value = true
  try {
    const { error } = await supabase.rpc('return_statement', { p_statement: props.statement.id, p_note: returnNote.value.trim() })
    if (error) throw error
    toast.add({ title: 'أُعيد الكشف إلى المعلّم.', color: 'success', icon: 'i-lucide-undo-2' })
    emit('returned', props.statement.id, returnNote.value.trim())
    emit('update:open', false)
  } catch (err) {
    handle(err)
  } finally {
    returnSaving.value = false
  }
}

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

type Item = { id: string, item_date: string | null, description: string | null, category: string | null, amount: number }
const items = ref<Item[]>([])
const loading = ref(false)
const marking = ref(false)
const spent = computed(() => items.value.reduce((s, i) => s + i.amount, 0))
const fmt = (n: number) => n.toLocaleString('ar')

watch(() => [props.open, props.statement?.id] as const, async ([open, id]) => {
  if (!open || !id) return
  returning.value = false
  returnNote.value = ''
  loading.value = true
  items.value = []
  try {
    const { data, error } = await supabase.from('incentive_statement_items')
      .select('id, item_date, description, category, amount').eq('statement_id', id).order('item_date')
    if (error) throw error
    items.value = data ?? []
  } catch (err) {
    handle(err)
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function markReviewed() {
  if (!props.statement) return
  marking.value = true
  try {
    const { error } = await supabase.from('incentive_statements')
      .update({ status: 'reviewed', reviewed_by: profile.value?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq('id', props.statement.id)
    if (error) throw error
    toast.add({ title: 'تمّ الاطّلاع على الكشف.', color: 'success', icon: 'i-lucide-check' })
    emit('reviewed', props.statement.id)
    emit('update:open', false)
  } catch (err) {
    handle(err)
  } finally {
    marking.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="statement ? `كشف ${statement.halaqa}` : 'كشف الحوافز'"
    description="بنود المصروف كما وثّقها المعلّم."
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div
        v-if="statement"
        class="totals"
      >
        <span>المستلَم <b>{{ fmt(statement.received) }}</b></span>
        <span>المصروف <b>{{ fmt(spent) }}</b></span>
        <span :class="{ out: statement.received - spent < 0 }">المتبقّي <b>{{ fmt(statement.received - spent) }}</b></span>
      </div>

      <UiEmptyState
        v-if="loading || !items.length"
        :icon="loading ? 'i-lucide-loader-circle' : 'i-lucide-receipt'"
        :title="loading ? 'تُحمَّل البنود…' : 'لا بنود في هذا الكشف'"
      />
      <ul
        v-else
        class="items"
      >
        <li
          v-for="it in items"
          :key="it.id"
        >
          <div class="it-main">
            <span class="it-desc">{{ it.description || '—' }}</span>
            <span class="it-meta">
              <span dir="ltr">{{ it.item_date ? formatDay(it.item_date) : 'بلا تاريخ' }}</span>
              <span v-if="it.category">· {{ it.category }}</span>
            </span>
          </div>
          <span class="it-amount">{{ fmt(it.amount) }}</span>
        </li>
      </ul>

      <p
        v-if="statement?.returnNote"
        class="prev-return"
      >
        <UIcon
          name="i-lucide-undo-2"
          class="size-4"
        />
        <span>أُعيد سابقاً: {{ statement.returnNote }}</span>
      </p>

      <div
        v-if="returning"
        class="return-box"
      >
        <UFormField
          label="ما الذي يصحّحه المعلّم؟"
          help="تظهر الملاحظة للمعلّم على كشفه، ويعود الكشف مسوّدةً يعدّلها ثم يرسلها."
        >
          <UTextarea
            v-model="returnNote"
            :rows="2"
            :maxlength="500"
            autofocus
            size="lg"
            class="w-full"
            placeholder="مثال: البند الأول مبلغه صفر، والبيان غير واضح"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
      </div>

      <div class="modal-actions">
        <UButton
          :label="returning ? 'تراجع' : 'إغلاق'"
          color="neutral"
          variant="ghost"
          size="lg"
          :ui="{ base: 'rounded-[13px]' }"
          @click="returning ? (returning = false) : emit('update:open', false)"
        />
        <UButton
          v-if="canReturn"
          :label="returning ? 'أعِد الكشف للمعلّم' : 'إعادة إلى المعلّم'"
          :color="returning ? 'warning' : 'neutral'"
          :variant="returning ? 'solid' : 'outline'"
          size="lg"
          icon="i-lucide-undo-2"
          :loading="returnSaving"
          :disabled="loading"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="returning ? sendBack() : (returning = true)"
        />
        <UButton
          v-if="!returning && canReview && statement?.status === 'submitted'"
          label="تمّ الاطّلاع"
          color="primary"
          size="lg"
          icon="i-lucide-check"
          :loading="marking"
          :disabled="loading"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="markReviewed"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.totals { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13.5px; color: var(--ink-3); margin-bottom: 14px; }
.totals b { color: var(--ink); font-weight: 700; margin-inline-start: 4px; font-variant-numeric: tabular-nums; }
.totals .out b { color: var(--err); }
.items { list-style: none; margin: 0; padding: 0; }
.items li { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; }
.items li + li { border-top: 1px solid var(--line); }
.it-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.it-desc { color: var(--ink); font-weight: 600; overflow-wrap: anywhere; }
.it-meta { color: var(--ink-3); font-size: 12.5px; display: flex; gap: 6px; flex-wrap: wrap; }
.it-amount { flex: none; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.prev-return { display: flex; align-items: flex-start; gap: 8px; margin: 14px 0 0; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); color: var(--ink-2); font-size: 13.5px; overflow-wrap: anywhere; }
.return-box { margin-top: 16px; }
</style>
