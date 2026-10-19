/**
 * بحثٌ عربيٌّ متسامح يطابق ما يكتبه المستخدم لا ما كتبناه: «الشوري» بالياء،
 * «الفاتحه» بالهاء، «انسان» بلا همزة، «٤٢» بالأرقام الهندية. التطبيعُ
 * للمطابقة وحدها؛ المعروضُ يبقى كما هو مكتوباً.
 */

/** يوحّد الحروف للمطابقة: تشكيلٌ محذوف · همزاتٌ موحَّدة · ى←ي · ة←ه. */
export function arabicFold(text: string): string {
  return text
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹'

/** مفتاحُ المطابقة: تطبيعُ الحروف وأرقامُ لوحةٍ عربية (من يعرف رقمَ السورة يكتبه). */
export function searchKey(text: string): string {
  return arabicFold(text)
    .replace(/[٠-٩]/g, digit => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(EASTERN_ARABIC.indexOf(digit)))
    .toLowerCase()
}

/**
 * ترشيحُ خياراتٍ بعناوينها (و`aliases` اختيارية كـ«ياسين» لـ«يس»).
 * طلبٌ فارغٌ يُعيدها كلَّها — قائمةٌ تُفتح خاليةً تُقرأ عطباً.
 */
export function filterByLabel<T extends { label: string, aliases?: string[] }>(items: T[], query: string): T[] {
  const needle = searchKey(query)
  if (!needle) return items

  return items.filter(item =>
    [item.label, ...(item.aliases ?? [])].some(text => searchKey(text).includes(needle))
  )
}
