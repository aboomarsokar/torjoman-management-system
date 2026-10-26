/**
 * منطقُ الحضور بلا إنترنت — نقيٌّ ومختبَر (نمطُ الصحابة، 2026-10-26).
 * كلُّ «حفظ حضور» يصير **سطراً واحداً لليوم** في صندوق الرفع (الأحدثُ يحلّ محلّ الأقدم لليوم نفسه)، ويُرفع وحده
 * بنداءٍ واحد (`save_attendance_day`) — فرفضُ يومٍ لا يحبس غيره. والشاشةُ تعرض اليومَ من الصندوق إن كان فيه،
 * وإلا من نسخة الجهاز.
 */
import { RETRY_DELAYS_MS } from '~/constants/offline'
import type { AbsenceKind } from '~/composables/useAttendanceDay'

export type Absences = Record<string, AbsenceKind>

/** يومٌ في نسخة الجهاز: سُجّل (انعقدت الحلقة) وغياباتُه. */
export interface MirrorDay { held: boolean, absences: Absences }

export interface OutboxEntry {
  /** `uid|halaqa|day` — يومٌ واحدٌ لكلّ معلّمٍ وحلقة. */
  key: string
  uid: string
  halaqaId: string
  day: string
  absences: Absences
  /** وقتُ الحفظ على الجهاز (ISO) — يُرفع معه فتعرف الإدارةُ متى سجّل المعلّم فعلاً. */
  recordedAt: string
  attempts: number
  /** `rejected`: رفضته القاعدةُ رفضاً لا تُصلحه الإعادة (شهرٌ اعتُمد، جمعة…) — ينتظر قرارَ المعلّم. */
  status: 'pending' | 'rejected'
  error?: string
}

export function entryKey(uid: string, halaqaId: string, day: string): string {
  return `${uid}|${halaqaId}|${day}`
}

export function newEntry(uid: string, halaqaId: string, day: string, absences: Absences, now: Date = new Date()): OutboxEntry {
  return { key: entryKey(uid, halaqaId, day), uid, halaqaId, day, absences: { ...absences }, recordedAt: now.toISOString(), attempts: 0, status: 'pending' }
}

/** اليومُ كما يُعرض: ما في الصندوق يغلب نسخةَ الجهاز (هو الأحدث)، ويُعدّ اليومُ مسجَّلاً. */
export function effectiveDay(mirror: MirrorDay | undefined, entry: OutboxEntry | undefined): MirrorDay & { pending: boolean } {
  if (entry) return { held: true, absences: { ...entry.absences }, pending: true }
  return { held: mirror?.held ?? false, absences: { ...(mirror?.absences ?? {}) }, pending: false }
}

/** غياباتُ مَن في القائمة وحدَهم — مَن لم يعد في الحلقة لا يُرفع غيابُه. */
export function absencesFor(draft: Absences, studentIds: string[]): Absences {
  const keep = new Set(studentIds)
  return Object.fromEntries(Object.entries(draft).filter(([id]) => keep.has(id)))
}

/** رموزُ أخطاء القاعدة التي لا تُصلحها الإعادة: حارسٌ رفض، أو صلاحية، أو صيغة. */
const PERMANENT_CODES = new Set(['P0001', '42501', '22023', '23514', '23503', '23505', '22007', '22P02', 'PGRST202'])
/** انتهاءُ الرمز — يُجدَّد ثمّ يُعاد. */
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', '401'])

export type SyncFailure = 'retry' | 'reauth' | 'reject'

/** كيف يُعامَل خطأُ الرفع: يُعاد لاحقاً (شبكة/خادم)، أو يُجدَّد الدخولُ ثمّ يُعاد، أو يُرفض نهائياً. */
export function classifySyncError(err: { code?: string | null, message?: string | null } | null | undefined): SyncFailure {
  const code = err?.code ?? ''
  if (AUTH_CODES.has(code) || /jwt expired|invalid jwt/i.test(err?.message ?? '')) return 'reauth'
  if (PERMANENT_CODES.has(code)) return 'reject'
  return 'retry'
}

/** مهلةُ المحاولة رقم `attempt` (من صفر) — وآخرُها تتكرّر بلا نهاية. */
export function nextRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempt, 0), RETRY_DELAYS_MS.length - 1)]!
}

/** عددُ الأيام بالعربية: يومٌ واحد · يومان · 3 أيام · 11 يوماً. */
export function daysCount(n: number): string {
  if (n === 1) return 'يومٌ واحد'
  if (n === 2) return 'يومان'
  return n <= 10 ? `${n} أيام` : `${n} يوماً`
}

/**
 * سطرُ الحالة للمعلّم (نمطُ الصحابة): ما ينتظر الرفعَ بعدده، وإلا نضارةُ البيانات. `syncedAt` وقتٌ معروض (`HH:MM`).
 */
export function syncStatusLine(s: { online: boolean, pending: number, rejected: number, syncing: boolean, syncedAt: string | null }): string {
  if (s.rejected) return `${daysCount(s.rejected)} لم تقبله الإدارة — راجِعه أدناه`
  if (s.pending) {
    if (!s.online) return `${daysCount(s.pending)} محفوظ على جهازك — يُرفع حين يعود الاتصال`
    return s.syncing ? `يجري رفع ${daysCount(s.pending)}…` : `${daysCount(s.pending)} بانتظار الرفع — يُرفع تلقائياً`
  }
  const fresh = s.syncedAt ? ` · البيانات محدَّثة ${s.syncedAt}` : ''
  return s.online ? `كلُّ شيءٍ مرفوع${fresh}` : `بلا اتصال${fresh} — ما تسجّله يُحفظ على جهازك`
}
