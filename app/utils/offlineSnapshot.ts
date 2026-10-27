/**
 * نُسخُ الشاشات التي تُقرأ على جهاز المعلّم (البند 14، الدفعة الأولى — 2026-10-27): آخرُ ما جلبته كلُّ شاشةٍ متّصلةً
 * (خطةُ الاختبارات، والبرامج المصاحبة، والزيارات، والتقييم، والتنبيهات، والرسائل، والملفّ الشخصيّ) يُحفظ في مخزن
 * `meta` بمفتاح `snap|<uid>|<مفتاح الجلب>`، ويُعرض بلا اتصال. **للمعلّم وحده**: غيرُه لا يُحفظ له شيءٌ على جهازه.
 * وتُمحى عند الخروج مع بقيّة نُسخ المعلّم (`forgetOfflineTeacher`).
 */
import { PROFILE_CACHE_KEY, readCache } from '~/utils/offlineCache'
import { idbGet, idbPut } from '~/utils/offlineDb'

export interface Snapshot<T> { savedAt: string, data: T }

export const SNAPSHOT_PREFIX = 'snap|'
export const snapshotKey = (uid: string, key: string) => `${SNAPSHOT_PREFIX}${uid}|${key}`

/** المعلّمُ صاحبُ الجهاز (من ملفّه المحفوظ — يُعرف بلا شبكة)؛ null لغير المعلّم. */
export function offlineTeacherUid(): string | null {
  if (!import.meta.client) return null
  const p = readCache<{ id?: string, role?: string }>(PROFILE_CACHE_KEY)
  return p?.role === 'teacher' && p.id ? p.id : null
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

/** «27-10 · 10:42» بتوقيت غزة — وقتُ آخر تحديثٍ للنسخة. */
export function formatSavedAt(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('day')}-${get('month')} · ${get('hour')}:${get('minute')}`
}
