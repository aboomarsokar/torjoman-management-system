<script setup lang="ts">
/**
 * مستنداتُ حركةٍ مالية (فواتير وإيصالات — ROADMAP #17): قائمةٌ تُفتح برابطٍ موقَّع، ورفعُ صورٍ أو PDF
 * وحذفُها للمدير الإداري. مشرفُ المشروع يطّلع بلا رفعٍ ولا حذف (الحكم لـRLS وسياسة المستودع).
 */
import type { TransactionDoc } from '~/composables/useTransactionDocs'

export interface DocsTransaction { id: string, description: string | null, amount: number, transaction_date: string }

interface Props {
  open: boolean
  transaction: DocsTransaction | null
  canEdit: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [boolean], 'changed': [] }>()

const txId = computed(() => (props.open ? props.transaction?.id ?? null : null))
const { docs, loading, uploading, upload, remove, open: openDoc } = useTransactionDocs(txId)

const fileInput = ref<HTMLInputElement | null>(null)
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  await upload(files)
  emit('changed')
}

const confirmId = ref<string | null>(null)
async function onRemove(doc: TransactionDoc) {
  if (confirmId.value !== doc.id) {
    confirmId.value = doc.id
    return
  }
  confirmId.value = null
  await remove(doc)
  emit('changed')
}
const fmt = (n: number) => n.toLocaleString('ar')
</script>

<template>
  <UModal
    :open="open"
    title="مستندات الحركة"
    :description="transaction ? `${transaction.description || 'بلا بيان'} · ${fmt(transaction.amount)} ₪ · ${formatDay(transaction.transaction_date)}` : undefined"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <UiEmptyState
        v-if="loading || !docs.length"
        :icon="loading ? 'i-lucide-loader-circle' : 'i-lucide-file-x'"
        :title="loading ? 'تُحمَّل المستندات…' : 'لا مستندات لهذه الحركة'"
        :description="!loading && canEdit ? 'ارفع صورة الفاتورة أو الإيصال (صورة أو PDF حتى 10 م.ب).' : undefined"
      />
      <ul
        v-else
        class="docs"
      >
        <li
          v-for="d in docs"
          :key="d.id"
        >
          <button
            type="button"
            class="doc-open"
            @click="openDoc(d)"
          >
            <UIcon
              :name="d.mime_type === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-image'"
              class="size-5 doc-ico"
            />
            <span class="doc-id">
              <span class="doc-name">{{ d.file_name }}</span>
              <span class="doc-meta">{{ formatDocSize(d.size_bytes) }} · <span dir="ltr">{{ formatDay(d.created_at) }}</span></span>
            </span>
          </button>
          <UButton
            v-if="canEdit"
            :label="confirmId === d.id ? 'تأكيد الحذف' : undefined"
            :icon="confirmId === d.id ? undefined : 'i-lucide-trash-2'"
            :color="confirmId === d.id ? 'error' : 'neutral'"
            :variant="confirmId === d.id ? 'solid' : 'ghost'"
            size="sm"
            aria-label="حذف المستند"
            :ui="{ base: 'rounded-[10px] min-h-[44px] min-w-[44px] justify-center' }"
            @click="onRemove(d)"
          />
        </li>
      </ul>

      <div class="actions">
        <UButton
          label="إغلاق"
          color="neutral"
          variant="ghost"
          size="lg"
          :ui="{ base: 'rounded-[13px]' }"
          @click="emit('update:open', false)"
        />
        <template v-if="canEdit">
          <input
            ref="fileInput"
            type="file"
            :accept="ACCEPT"
            multiple
            class="sr-only"
            @change="onPick"
          >
          <UButton
            label="رفع مستند"
            icon="i-lucide-upload"
            color="primary"
            size="lg"
            :loading="uploading"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="fileInput?.click()"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.docs { list-style: none; margin: 0; padding: 0; }
.docs li { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.docs li + li { border-top: 1px solid var(--line); }
.doc-open { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 8px 4px; min-height: 44px; background: none; border: 0; cursor: pointer; text-align: start; color: inherit; border-radius: 10px; }
.doc-open:hover { background: var(--surface-2); }
.doc-ico { color: var(--blue); flex: none; }
.doc-id { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.doc-name { color: var(--ink); font-weight: 600; overflow-wrap: anywhere; }
.doc-meta { color: var(--ink-3); font-size: 12.5px; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
