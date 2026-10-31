/**
 * مكتبةُ المشروع وصورُ الهويات — منطقٌ صرفٌ مختبَر: امتدادُ الملفّ ونوعُه، وأخطاءُ النموذج بالعربية، وحجمُ الملفّ
 * مقروءاً، وتجميعُ المستندات بتصنيفها، واسمُ صورة الهوية داخل الملفّ المضغوط.
 */
import {
  ID_CARD_MAX_BYTES, LIBRARY_MAX_BYTES, LIBRARY_TYPES, MAX_LIBRARY_CATEGORY, MAX_LIBRARY_DESCRIPTION, MAX_LIBRARY_TITLE
} from '~/constants/library'

/** امتدادُ الملفّ المقبول في المكتبة (jpeg ← jpg)، أو null. */
export function libraryExt(fileName: string): string | null {
  const raw = fileName.toLowerCase().split('.').pop() ?? ''
  const ext = raw === 'jpeg' ? 'jpg' : raw
  return ext in LIBRARY_TYPES ? ext : null
}

/** خطأُ ملفّ المكتبة بالعربية، أو null. */
export function libraryFileError(file: { name: string, size: number }, pdfOnly = false): string | null {
  const ext = libraryExt(file.name)
  if (!ext || (pdfOnly && ext !== 'pdf')) return pdfOnly ? 'الملزمة ملفُّ PDF.' : 'نوعُ الملفّ غيرُ مقبول: PDF أو صورة أو Word أو Excel أو PowerPoint.'
  if (file.size <= 0) return 'الملفّ فارغ.'
  if (file.size > LIBRARY_MAX_BYTES) return 'الملفّ أكبر من 50 ميغا.'
  return null
}

export interface LibraryDraft { title: string, description: string, category: string, audience: 'all' | 'staff' }

/** خطأُ بيانات المستند بالعربية، أو null. */
export function libraryDraftError(d: LibraryDraft): string | null {
  if (!d.title.trim()) return 'اكتب عنوان المستند.'
  if (d.title.trim().length > MAX_LIBRARY_TITLE) return `العنوان لا يتجاوز ${MAX_LIBRARY_TITLE} حرفاً.`
  if (d.description.trim().length > MAX_LIBRARY_DESCRIPTION) return `الوصف لا يتجاوز ${MAX_LIBRARY_DESCRIPTION} حرف.`
  if (!d.category.trim()) return 'اختر التصنيف أو اكتبه.'
  if (d.category.trim().length > MAX_LIBRARY_CATEGORY) return `التصنيف لا يتجاوز ${MAX_LIBRARY_CATEGORY} حرفاً.`
  return null
}

/** «2.4 م.ب» / «350 ك.ب». */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`
  return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`
}

/** المستنداتُ مجموعةً بتصنيفها، والتصنيفاتُ بالترتيب الأبجديّ و«عام» آخرها. */
export function groupByCategory<T extends { category: string }>(items: T[], last = 'عام'): { category: string, items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const it of items) map.set(it.category, [...(map.get(it.category) ?? []), it])
  return [...map.entries()]
    .sort(([a], [b]) => (a === last ? 1 : b === last ? -1 : a.localeCompare(b, 'ar')))
    .map(([category, list]) => ({ category, items: list }))
}

/** امتدادُ صورة الهوية من نوعها، أو null إن لم يُقبل. */
export function idCardExt(mime: string): 'jpg' | 'png' | 'webp' | 'pdf' | null {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as const)[mime as 'image/jpeg'] ?? null
}

/** خطأُ ملفّ الهوية قبل التصغير بالعربية، أو null (الصورةُ تُصغَّر فلا يُفحص حجمُها هنا). */
export function idCardFileError(file: { type: string, size: number }): string | null {
  if (!idCardExt(file.type)) return 'اختر صورةً (JPEG أو PNG أو WebP) أو ملفَّ PDF.'
  if (file.type === 'application/pdf' && file.size > ID_CARD_MAX_BYTES) return 'ملفُّ PDF أكبر من 5 ميغا — صوّر الهوية بدلاً منه.'
  return null
}

/** اسمُ صورة الهوية في الملفّ المضغوط: «1049 - أمجد رفيق أبو مطر.jpg» — وتُحذف رموزٌ لا تصلح في أسماء الملفّات. */
export function idCardZipName(employeeNumber: string | null, fullName: string, ext: string, taken: Set<string>): string {
  const safe = fullName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  const base = employeeNumber ? `${employeeNumber} - ${safe}` : safe
  let name = `${base}.${ext}`
  for (let i = 2; taken.has(name); i++) name = `${base} (${i}).${ext}`
  taken.add(name)
  return name
}
