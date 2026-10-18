/**
 * كلمة المرور المؤقّتة لكل حسابٍ جديد أو مُعاد تعيينه — يولّدها الخادم وحده وتُعاد مرّةً واحدة في الردّ.
 * ⚠️ لا تُسجَّل في أي سجلّ ولا تُحفظ في ملف؛ صاحبها يغيّرها إلزاماً عند أول دخول (must_change_password).
 * الأبجدية بلا المحارف الملتبسة (0/O و1/l/I) لأن المدير يمليها أو يكتبها للعامل بيده.
 */

/** الطول الافتراضي — 12 خانة من أبجديةٍ بـ56 محرفاً ≈ 70 بت. */
export const TEMP_PASSWORD_LENGTH = 12
export const TEMP_PASSWORD_MIN_LENGTH = 10

const LOWER = 'abcdefghijkmnopqrstuvwxyz' // بلا l
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // بلا I وO
const DIGITS = '23456789' // بلا 0 و1
export const TEMP_PASSWORD_ALPHABET = LOWER + UPPER + DIGITS

/** عددٌ عشوائيّ تشفيريّ في [0, max) بلا انحياز الباقي (رفضُ ما يتجاوز آخر مضاعفٍ كامل). */
function randomIndex(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buf)
    const value = buf[0]!
    if (value < limit) return value % max
  }
}

function pick(set: string): string {
  return set[randomIndex(set.length)]!
}

/**
 * كلمة مرور مؤقّتة: حرفٌ صغير وحرفٌ كبير ورقمٌ على الأقل (تكفي أي سياسة كلمات مرور في Supabase)،
 * والباقي من الأبجدية كلّها، ثم خلطٌ عشوائيّ (Fisher–Yates) كي لا تُعرف مواضع الفئات.
 */
export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  const size = Math.max(length, TEMP_PASSWORD_MIN_LENGTH)
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)]
  while (chars.length < size) chars.push(pick(TEMP_PASSWORD_ALPHABET))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}
