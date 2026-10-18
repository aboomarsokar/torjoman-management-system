/**
 * استخراج نصّ الخطأ وتمييز الرسائل العربية الجاهزة للعرض كما هي.
 * رسائل الخادم (statusMessage) ورسائل الدخول عربيةٌ أصلاً — تُعرض بلا ترجمة.
 */

/** هل في النصّ حرفٌ عربيّ؟ (الرسائل العربية جاهزةٌ للمستخدم، والإنجليزية تحتاج ترجمة). */
export function hasArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text)
}

/**
 * النصّ الخام للخطأ: لخطأ $fetch (ofetch) يُفضَّل statusMessage القادم من الخادم
 * على message المركَّبة (`[POST] "/url": 401 …`).
 */
export function rawErrorText(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const e = err as { statusMessage?: unknown, data?: { statusMessage?: unknown }, message?: unknown }
    if (typeof e.statusMessage === 'string' && e.statusMessage) return e.statusMessage
    if (typeof e.data?.statusMessage === 'string' && e.data.statusMessage) return e.data.statusMessage
    if (typeof e.message === 'string') return e.message
  }
  return ''
}
