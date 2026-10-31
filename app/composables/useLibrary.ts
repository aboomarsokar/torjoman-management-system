/**
 * مكتبةُ المشروع (طلب المستخدم 2026-10-31): الملازمُ الخمسَ عشرة (ملفٌّ لكلّ ملزمة يُستبدل بالأحدث) والمستنداتُ العامة.
 * القراءةُ لكلّ حسابٍ نشط بحسب الجمهور (RLS)، والرفعُ والتعديلُ والحذفُ للمدير الإداريّ وحده. كلُّ رفعٍ باسمٍ جديد
 * ثم يُحذف القديم بعد نجاح الصفّ — فلا يشير صفٌّ إلى ملفٍّ محذوف. والفتحُ برابطٍ موقَّتٍ قصير.
 */
import type { Database } from '~/types/database.types'
import { BOOKLETS } from '~/constants/booklets'
import { LIBRARY_BUCKET, LIBRARY_TYPES, SIGNED_URL_SECONDS } from '~/constants/library'
import { libraryDraftError, libraryExt, libraryFileError, type LibraryDraft } from '~/utils/library'

export type LibraryItem = Database['public']['Tables']['library_items']['Row']

export function useLibrary() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const items = ref<LibraryItem[]>([])
  const loading = ref(false)
  const busy = ref(false)

  const booklets = computed(() => new Map(items.value.filter(i => i.booklet !== null).map(i => [i.booklet!, i])))
  const documents = computed(() => items.value.filter(i => i.booklet === null))

  async function load() {
    loading.value = true
    const { data, error } = await supabase.from('library_items').select('*').order('created_at', { ascending: false })
    loading.value = false
    if (error) {
      handle(error)
      return
    }
    items.value = data ?? []
  }

  function warn(title: string) {
    toast.add({ title, color: 'warning', icon: 'i-lucide-circle-alert' })
    return false
  }

  /** يرفع الملفّ باسمٍ جديد ويُعيد مساره ونوعه. */
  async function putFile(folder: 'booklets' | 'docs', file: File) {
    const ext = libraryExt(file.name)!
    const path = `${folder}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, file, { contentType: LIBRARY_TYPES[ext] })
    if (error) throw error
    return { path, mime: LIBRARY_TYPES[ext]! }
  }

  async function dropFile(path: string | undefined) {
    if (path) await supabase.storage.from(LIBRARY_BUCKET).remove([path])
  }

  async function guarded(task: () => Promise<void>, done: string): Promise<boolean> {
    busy.value = true
    try {
      await task()
      toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
      await load()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  /** ملفُّ الملزمة (PDF) — يُستبدل إن وُجد. */
  async function uploadBooklet(no: number, file: File): Promise<boolean> {
    const problem = libraryFileError(file, true)
    if (problem) return warn(problem)
    const old = booklets.value.get(no)
    const label = BOOKLETS.find(b => b.no === no)?.label ?? ''
    return guarded(async () => {
      const { path, mime } = await putFile('booklets', file)
      const row = { file_path: path, file_name: file.name, mime_type: mime, size_bytes: file.size }
      const { error } = old
        ? await supabase.from('library_items').update(row).eq('id', old.id)
        : await supabase.from('library_items').insert({ ...row, booklet: no, title: `الملزمة ${no} — ${label}`, category: 'الملازم' })
      if (error) {
        await dropFile(path)
        throw error
      }
      await dropFile(old?.file_path)
    }, old ? 'استُبدل ملفُّ الملزمة.' : 'رُفع ملفُّ الملزمة.')
  }

  /** مستندٌ جديد (بملفّه) أو تعديلُ بياناته (والملفُّ اختياريّ للاستبدال). */
  async function saveDocument(d: LibraryDraft, file: File | null, existing?: LibraryItem): Promise<boolean> {
    const problem = libraryDraftError(d) ?? (file ? libraryFileError(file) : existing ? null : 'اختر الملفّ.')
    if (problem) return warn(problem)
    return guarded(async () => {
      const meta = { title: d.title.trim(), description: d.description.trim() || null, category: d.category.trim(), audience: d.audience }
      const put = file ? await putFile('docs', file) : null
      const fileRow = put ? { file_path: put.path, file_name: file!.name, mime_type: put.mime, size_bytes: file!.size } : {}
      const { error } = existing
        ? await supabase.from('library_items').update({ ...meta, ...fileRow }).eq('id', existing.id)
        : await supabase.from('library_items').insert({ ...meta, ...(fileRow as Required<typeof fileRow>) } as Database['public']['Tables']['library_items']['Insert'])
      if (error) {
        await dropFile(put?.path)
        throw error
      }
      if (put && existing) await dropFile(existing.file_path)
    }, existing ? 'حُفظت التعديلات.' : 'أُضيف المستند إلى المكتبة.')
  }

  async function remove(item: LibraryItem): Promise<boolean> {
    return guarded(async () => {
      const { error } = await supabase.from('library_items').delete().eq('id', item.id)
      if (error) throw error
      await dropFile(item.file_path)
    }, 'حُذف من المكتبة.')
  }

  /** يفتح الملفّ في نافذةٍ جديدة، أو ينزّله باسمه. */
  async function open(item: LibraryItem, download = false) {
    const { data, error } = await supabase.storage.from(LIBRARY_BUCKET)
      .createSignedUrl(item.file_path, SIGNED_URL_SECONDS, download ? { download: item.file_name } : undefined)
    if (error || !data) {
      handle(error ?? new Error('تعذّر فتح الملفّ.'))
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return { items, booklets, documents, loading, busy, load, uploadBooklet, saveDocument, remove, open }
}
