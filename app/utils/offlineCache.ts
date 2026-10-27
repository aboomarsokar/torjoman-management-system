/**
 * ما يحتاجه رأسُ اللوحة بلا إنترنت (طلب المستخدم 2026-10-26: القائمةُ والجرسُ والصورةُ في تطبيق المعلّم متّصلاً أو لا):
 * آخرُ ما عُرف من الملفّ الشخصيّ والصندوق والصورة، في التخزين المحلّيّ. يُكتب كلّما نجح جلبٌ متّصلاً، ويُقرأ حين لا
 * اتصال، ويُمحى عند الخروج — فلا يرى مستخدمٌ تالٍ على الجهاز نفسِه ملفَّ سابقه. وفشلُ التخزين صامت (يبقى ما كان).
 */
export const PROFILE_CACHE_KEY = 'torjoman-offline-profile'
export const INBOX_CACHE_KEY = 'torjoman-offline-inbox'
export const PHOTO_CACHE_KEY = 'torjoman-offline-photo'
/** آخرُ بيانات لوحة المعلّم (2026-10-27) — تُعرض بلا إنترنت. */
export const TEACHER_DASH_CACHE_KEY = 'torjoman-offline-teacher-dash'
/** متى حُدّثت نُسخُ المعلّم آخرَ مرّة (`useWarmTeacherMirrors`) — يُمحى مع النُّسخ عند الخروج فتُعاد بعد الدخول. */
export const WARMED_CACHE_KEY = 'torjoman-offline-warmed'

/** صورةٌ أكبرُ من هذا لا تُخزَّن (التخزينُ المحلّيّ محدودٌ بنحو 5 م.ب للأصل). */
export const MAX_CACHED_PHOTO_CHARS = 400_000

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ممتلئٌ أو محجوب */ }
}

export function clearOfflineCaches(): void {
  for (const key of [PROFILE_CACHE_KEY, INBOX_CACHE_KEY, PHOTO_CACHE_KEY, TEACHER_DASH_CACHE_KEY, WARMED_CACHE_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch { /* محجوب */ }
  }
}

/** يحوّل صورةً إلى رابط بيانات ليُعرض بلا شبكة — أو null إن تعذّر أو كبُرت. */
export async function toDataUrl(blob: Blob): Promise<string | null> {
  const data = await new Promise<string | null>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
  return data && data.length <= MAX_CACHED_PHOTO_CHARS ? data : null
}
