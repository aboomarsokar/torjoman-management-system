/**
 * ملفّاتُ مقرّرات البرامج المصاحبة وإدارتُها — التنزيلُ للطالب والعاملين (رابطٌ موقَّتٌ من المستودع الخاصّ
 * `reading-books`؛ والقاعدةُ تقصر الطالبَ على مقرّره المستحقّ وما اجتازه)، والرفعُ وإضافةُ المقرّرات والكتب
 * للمديرين (سياساتُ الجداول والمستودع هي الحَكَم). التحقّقُ نقيٌّ ومختبَر.
 */
import type { Database } from '~/types/database.types'

export const READING_BUCKET = 'reading-books'
/** حدُّ الملفّ — مطابقٌ لحدّ المستودع (50 م.ب). */
export const READING_PDF_MAX_BYTES = 50 * 1024 * 1024
/** مدّةُ رابط التنزيل بالثواني. */
const SIGNED_URL_SECONDS = 300

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر']

/** «المقرّر الخامس»؛ وما بعد الثاني عشر بالرقم. */
export function unitTitle(order: number): string {
  return `المقرّر ${ORDINALS[order - 1] ?? order}`
}

/** مسارُ ملفّ المقرّر في المستودع. */
export function unitPdfPath(unitId: number): string {
  return `units/${unitId}.pdf`
}

/** خطأُ الملفّ المختار، أو null. */
export function pdfFileError(file: { type: string, size: number, name: string }): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'الملفّ يجب أن يكون PDF.'
  if (file.size > READING_PDF_MAX_BYTES) return 'الملفّ أكبر من 50 م.ب.'
  return null
}

export interface PartDraft { bookId: number | undefined, from: number | string, to: number | string }

/** خطأُ أجزاء المقرّر الجديد، أو null: كتابٌ لكلّ جزء، وصفحاتٌ صحيحةٌ ضمن الكتاب. */
export function partsError(parts: PartDraft[], books: { id: number, pages: number | null }[]): string | null {
  if (!parts.length) return 'أضف كتاباً واحداً على الأقلّ.'
  for (const [i, p] of parts.entries()) {
    const n = i + 1
    const book = books.find(b => b.id === p.bookId)
    if (!book) return `اختر كتاب الجزء ${n}.`
    const from = Number(p.from)
    const to = Number(p.to)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return `صفحات الجزء ${n} غير صحيحة.`
    if (book.pages && to > book.pages) return `الجزء ${n} يتجاوز صفحات الكتاب (${book.pages}).`
  }
  return null
}

export function useReadingAdmin() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  async function withBusy<T>(task: () => Promise<T>): Promise<T | null> {
    busy.value = true
    try {
      return await task()
    } catch (err) {
      handle(err)
      return null
    } finally {
      busy.value = false
    }
  }

  /** ينزّل ملفَّ المقرّر برابطٍ موقَّتٍ باسمٍ مقروء. */
  async function download(unit: { title: string, pdfPath?: string | null }) {
    if (!unit.pdfPath) return
    await withBusy(async () => {
      const { data, error } = await supabase.storage.from(READING_BUCKET)
        .createSignedUrl(unit.pdfPath!, SIGNED_URL_SECONDS, { download: `${unit.title}.pdf` })
      if (error || !data) throw error ?? new Error('تعذّر تجهيز رابط التنزيل.')
      window.location.href = data.signedUrl
    })
  }

  /** يرفع ملفَّ المقرّر (استبدالاً) ثم يثبّت مساره. */
  async function uploadPdf(unitId: number, file: File): Promise<boolean> {
    const invalid = pdfFileError(file)
    if (invalid) {
      toast.add({ title: invalid, color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
    const ok = await withBusy(async () => {
      const path = unitPdfPath(unitId)
      const { error } = await supabase.storage.from(READING_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true })
      if (error) throw error
      const { error: setError } = await supabase.from('reading_units').update({ pdf_path: path }).eq('id', unitId)
      if (setError) throw setError
      return true
    })
    if (ok) toast.add({ title: 'رُفع ملفّ المقرّر.', color: 'success', icon: 'i-lucide-circle-check' })
    return !!ok
  }

  /** يضيف مقرّراً في آخر الخطّة بأجزائه. */
  async function addUnit(nextOrder: number, parts: PartDraft[]): Promise<boolean> {
    const ok = await withBusy(async () => {
      const { data: unit, error } = await supabase.from('reading_units')
        .insert({ sort_order: nextOrder, title: unitTitle(nextOrder) }).select('id').single()
      if (error || !unit) throw error
      const rows = parts.map((p, i) => ({ unit_id: unit.id, book_id: p.bookId!, page_from: Number(p.from), page_to: Number(p.to), sort_order: i + 1 }))
      const { error: partsErr } = await supabase.from('reading_unit_parts').insert(rows)
      if (partsErr) {
        // لا يبقى مقرّرٌ بلا أجزاء
        await supabase.from('reading_units').delete().eq('id', unit.id)
        throw partsErr
      }
      return true
    })
    if (ok) toast.add({ title: `أُضيف ${unitTitle(nextOrder)}.`, color: 'success', icon: 'i-lucide-circle-check' })
    return !!ok
  }

  /** يضيف كتاباً إلى قائمة الكتب. */
  async function addBook(book: { title: string, author: string, pages: number | null }): Promise<boolean> {
    if (!book.title.trim()) {
      toast.add({ title: 'اكتب عنوان الكتاب.', color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
    const ok = await withBusy(async () => {
      const { error } = await supabase.from('reading_books')
        .insert({ title: book.title.trim(), author: book.author.trim() || null, pages: book.pages || null })
      if (error) throw error
      return true
    })
    if (ok) toast.add({ title: 'أُضيف الكتاب.', color: 'success', icon: 'i-lucide-circle-check' })
    return !!ok
  }

  return { busy, download, uploadPdf, addUnit, addBook }
}
