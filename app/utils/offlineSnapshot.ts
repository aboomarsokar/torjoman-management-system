/**
 * نُسخُ الشاشات التي تُقرأ على جهاز المعلّم والمشرف الميداني والمختبِر (البند 14، الدفعة الأولى — 2026-10-27، وعُمّمت
 * على المشرف والمختبِر 2026-10-29): آخرُ ما جلبته كلُّ شاشةٍ متّصلةً (خطةُ الاختبارات، والبرامج المصاحبة، والزيارات،
 * والتقييم، والتنبيهات، والرسائل، والملفّ الشخصيّ) يُحفظ في مخزن `meta` بمفتاح `snap|<uid>|<مفتاح الجلب>`، ويُعرض بلا
 * اتصال. **لهؤلاء الثلاثة وحدهم**: غيرُهم لا يُحفظ له شيءٌ على جهازه. وتُمحى عند الخروج مع بقيّة نُسخهم
 * (`forgetOfflineTeacher`).
 */
import { PROFILE_CACHE_KEY, readCache } from '~/utils/offlineCache'
import { impersonatingNow } from '~/utils/impersonation'
import { idbGet, idbPut } from '~/utils/offlineDb'
import { gazaClock12 } from '~/utils/time'

export interface Snapshot<T> { savedAt: string, data: T }

export const SNAPSHOT_PREFIX = 'snap|'
export const snapshotKey = (uid: string, key: string) => `${SNAPSHOT_PREFIX}${uid}|${key}`

/** المعلّمُ صاحبُ الجهاز (من ملفّه المحفوظ — يُعرف بلا شبكة)؛ null لغير المعلّم. */
export function offlineTeacherUid(): string | null {
  if (!import.meta.client) return null
  const p = readCache<{ id?: string, role?: string }>(PROFILE_CACHE_KEY)
  return p?.role === 'teacher' && p.id ? p.id : null
}

/** الأدوارُ التي تعمل بلا اتصال: المعلّم والمشرفُ الميدانيّ والمختبِر — لا غيرُهم. */
export type OfflineOwnerRole = 'teacher' | 'field_supervisor' | 'examiner'

const OFFLINE_OWNER_ROLES: readonly string[] = ['teacher', 'field_supervisor', 'examiner']

/**
 * دورُ صاحب الجهاز من ملفّه المحفوظ (يُعرف بلا شبكة)؛ null لغير الثلاثة.
 * بلا حارس `import.meta.client`: `readCache` تبتلع غيابَ التخزين المحلّيّ (الخادم) فتردّ null.
 */
export function offlineOwnerRole(): OfflineOwnerRole | null {
  const p = readCache<{ role?: string }>(PROFILE_CACHE_KEY)
  return p?.role && OFFLINE_OWNER_ROLES.includes(p.role) ? p.role as OfflineOwnerRole : null
}

/**
 * صاحبُ الجهاز لأدوار `OfflineOwnerRole`. المشرفُ والمختبِر أثناء النيابة بلا صاحب (null): لا تُحفظ نسخٌ ولا يُوضع
 * شيءٌ في صندوق باسم من يُنوَب عنه. أمّا المعلّمُ فكما كان — لا يتأثّر بالنيابة.
 */
export function offlineOwnerUid(): string | null {
  const role = offlineOwnerRole()
  if (!role) return null
  if (role !== 'teacher' && impersonatingNow()) return null
  return readCache<{ id?: string }>(PROFILE_CACHE_KEY)?.id || null
}

export async function readSnapshot<T>(uid: string, key: string): Promise<Snapshot<T> | null> {
  return (await idbGet<Snapshot<T>>('meta', snapshotKey(uid, key)).catch(() => undefined)) ?? null
}

export async function writeSnapshot<T>(uid: string, key: string, data: T, now: Date = new Date()): Promise<void> {
  await idbPut('meta', { savedAt: now.toISOString(), data } satisfies Snapshot<T>, snapshotKey(uid, key)).catch(() => undefined)
}

/** يعدّل النسخةَ المحفوظة (اطّلاعٌ سُجّل بلا اتصال) — بلا نسخةٍ لا شيء. */
export async function patchSnapshot<T>(uid: string, key: string, patch: (data: T) => T): Promise<void> {
  const snap = await readSnapshot<T>(uid, key)
  if (snap) await idbPut('meta', { ...snap, data: patch(snap.data) }, snapshotKey(uid, key)).catch(() => undefined)
}

const GAZA_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit' })

/** «27-10 · 10:42 ص» بتوقيت غزة وبنظام 12 ساعة (طلب المستخدم 2026-10-28) — وقتُ آخر تحديثٍ للنسخة. */
export function formatSavedAt(iso: string): string {
  const parts = GAZA_DAY.formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('day')}-${get('month')} · ${gazaClock12(iso)}`
}
