/**
 * بحث القوائم (الطلاب، المستخدمون): مطابقةٌ جزئية تتسامح مع ما يختلف فيه الكاتبون —
 * الأرقام العربية/الهندية، والتشكيل والتطويل، وأشكال الألف والتاء المربوطة والياء.
 */
import { normalizeDigits } from '~/constants/identity'

/** يطبّع النصّ للمقارنة: أرقام لاتينية، بلا تشكيل/تطويل، ألف واحدة، ة ← ه، ى ← ي، مسافات مضغوطة. */
export function normalizeSearch(value: string): string {
  return normalizeDigits(value)
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** هل يطابق الاستعلام أحد الحقول؟ كل كلمةٍ في الاستعلام يجب أن توجد في حقلٍ ما؛ والاستعلام الفارغ يطابق الكل. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  if (!words.length) return true
  const haystack = fields.filter(Boolean).map(f => normalizeSearch(f as string)).join(' | ')
  return words.every(w => haystack.includes(w))
}
