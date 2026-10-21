/**
 * عرضُ الوقت بصيغة 12 ساعة بالعربية — «4:00 م» لا «16:00» (طلب المستخدم 2026-10-21). يُخزَّن الوقتُ في
 * القاعدة `time` (`HH:MM[:SS]`) ويُحوَّل عند العرض وحده؛ حقولُ الإدخال تبقى على قيمة `HH:MM`.
 */

/** `HH:MM[:SS]` ← «h:MM ص/م»؛ الفارغُ أو غيرُ المفهوم ← ''. */
export function formatTime12(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? '')
  if (!m) return ''
  const h = Number(m[1])
  if (h > 23) return ''
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${h < 12 ? 'ص' : 'م'}`
}
