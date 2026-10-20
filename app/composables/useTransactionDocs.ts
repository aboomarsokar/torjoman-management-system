import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import { FINANCE_DOC_EXT, FINANCE_DOC_URL_SECONDS, FINANCE_DOCS_BUCKET, MAX_FINANCE_DOC_BYTES } from '~/constants/financeDocs'

/**
 * مستنداتُ حركةٍ مالية واحدة (ROADMAP #17): الفاتورةُ أو الإيصال يُرفع إلى المستودع الخاصّ ثم يُسجَّل صفُّه،
 * فإن رُفض الصفّ حُذف الملفّ فلا يبقى يتيماً. والحذفُ يمسح الصفَّ أولاً ثم الملفّ (فلا يبقى صفٌّ بلا ملفّ).
 * الفتحُ برابطٍ موقَّعٍ قصير، تُفتح نافذتُه قبل الانتظار كي لا يحجبها المتصفّح.
 */
export type TransactionDoc = Database['public']['Tables']['transaction_attachments']['Row']

/** خطأُ الملفّ بالعربية، أو `null` إن صلح. */
export function financeDocError(file: { type: string, size: number }): string | null {
  if (!FINANCE_DOC_EXT[file.type]) return 'الملفّ صورةٌ (JPG أو PNG أو WEBP) أو PDF.'
  if (file.size <= 0) return 'الملفّ فارغ.'
  if (file.size > MAX_FINANCE_DOC_BYTES) return 'الملفّ أكبر من 10 م.ب.'
  return null
}

/** مسارُ المستند: `transactions/<الحركة>/<uuid>.<امتداد>` — الشكلُ الذي تقبله سياسةُ المستودع وقيدُ الجدول. */
export function financeDocPath(transactionId: string, fileId: string, mime: string): string {
  return `transactions/${transactionId}/${fileId}.${FINANCE_DOC_EXT[mime]}`
}

/** حجمٌ مقروء: «850 ك.ب» أو «2.4 م.ب». */
export function formatDocSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
}

export function useTransactionDocs(transactionId: Ref<string | null>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const docs = ref<TransactionDoc[]>([])
  const loading = ref(false)
  const uploading = ref(false)
  // في نيابة القراءة يُرفض الرفعُ والحذفُ قبل الإرسال برسالةٍ عربية (رفضُ المستودع إنجليزيٌّ عامّ)
  const { blockIfReadOnly } = useImpersonation()

  async function load() {
    docs.value = []
    if (!transactionId.value) return
    loading.value = true
    try {
      const { data, error } = await supabase.from('transaction_attachments').select('*')
        .eq('transaction_id', transactionId.value).order('created_at')
      if (error) throw error
      docs.value = data ?? []
    } catch (err) {
      handle(err)
    } finally {
      loading.value = false
    }
  }

  async function upload(files: File[]) {
    const txId = transactionId.value
    if (!txId || !files.length) return
    const bad = files.map(f => financeDocError(f)).find(Boolean)
    if (bad) {
      toast.add({ title: bad, color: 'warning', icon: 'i-lucide-info' })
      return
    }
    uploading.value = true
    let added = 0
    try {
      blockIfReadOnly()
      for (const file of files) {
        const path = financeDocPath(txId, crypto.randomUUID(), file.type)
        const { error: upErr } = await supabase.storage.from(FINANCE_DOCS_BUCKET).upload(path, file, { contentType: file.type })
        if (upErr) throw upErr
        const { error } = await supabase.from('transaction_attachments')
          .insert({ transaction_id: txId, storage_path: path, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size })
        if (error) {
          await supabase.storage.from(FINANCE_DOCS_BUCKET).remove([path])
          throw error
        }
        added++
      }
    } catch (err) {
      handle(err)
    } finally {
      uploading.value = false
      if (added) toast.add({ title: added === 1 ? 'رُفع المستند.' : `رُفعت ${added} مستندات.`, color: 'success', icon: 'i-lucide-paperclip' })
      await load()
    }
  }

  async function remove(doc: TransactionDoc) {
    try {
      blockIfReadOnly()
      const { error } = await supabase.from('transaction_attachments').delete().eq('id', doc.id)
      if (error) throw error
      await supabase.storage.from(FINANCE_DOCS_BUCKET).remove([doc.storage_path])
      docs.value = docs.value.filter(d => d.id !== doc.id)
      toast.add({ title: 'حُذف المستند.', color: 'neutral', icon: 'i-lucide-trash-2' })
    } catch (err) {
      handle(err)
    }
  }

  async function open(doc: TransactionDoc) {
    const win = window.open('', '_blank')
    try {
      const { data, error } = await supabase.storage.from(FINANCE_DOCS_BUCKET).createSignedUrl(doc.storage_path, FINANCE_DOC_URL_SECONDS)
      if (error || !data) throw error
      if (win) win.location.href = data.signedUrl
      else window.location.href = data.signedUrl
    } catch (err) {
      win?.close()
      handle(err)
    }
  }

  watch(transactionId, load, { immediate: true })

  return { docs, loading, uploading, upload, remove, open, reload: load }
}
