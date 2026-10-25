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

/**
 * كلمةُ بحثٍ مطبَّعة ← نمطُ regex لـPostgREST (`imatch`) يتسامح فيما يتسامح فيه `normalizeSearch`: أشكالُ الألف
 * والتاء المربوطة والياء، والتشكيلُ والتطويلُ بين الحروف — للبحث على الخادم حين تُرقَّم القائمةُ هناك (2026-10-25).
 */
export function searchWordPattern(word: string): string {
  const MARKS = '[ً-ْٰـ]*'
  const LETTER: Record<string, string> = { ا: '[اأإآٱ]', ه: '[هة]', ي: '[يى]' }
  return [...word].map(ch => LETTER[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(MARKS)
}

/**
 * شروطُ البحث على الخادم بمعنى `matchesSearch`: لكلّ كلمةٍ شرطُ `or(...)` بين الحقلين، والكلماتُ مجتمعة
 * (كلُّ نداءٍ لـ`.or()` يُضمّ بـAND). الكلمةُ الرقمية تُطابَق في حقل الأرقام أيضاً (الهوية).
 */
export function serverSearchClauses(query: string, textField: string, digitField?: string): string[] {
  const quote = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return normalizeSearch(query).split(' ').filter(Boolean).map((w) => {
    const parts = [`${textField}.imatch.${quote(searchWordPattern(w))}`]
    if (digitField && /^\d+$/.test(w)) parts.push(`${digitField}.ilike.${quote(`*${w}*`)}`)
    return parts.join(',')
  })
}

/** هل يطابق الاستعلام أحد الحقول؟ كل كلمةٍ في الاستعلام يجب أن توجد في حقلٍ ما؛ والاستعلام الفارغ يطابق الكل. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  if (!words.length) return true
  const haystack = fields.filter(Boolean).map(f => normalizeSearch(f as string)).join(' | ')
  return words.every(w => haystack.includes(w))
}
