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

/** سطرُ الحالة للمعلّم. */
export function syncStatusText(pending: number, rejected: number, online: boolean, syncing: boolean): string {
  if (rejected) return `${rejected === 1 ? 'يومٌ' : `${rejected} أيام`} لم تقبله الإدارة — راجِعه`
  if (!pending) return online ? 'كلُّ الحضور مرفوع' : 'لا اتصال — ما تسجّله يُحفظ على جهازك'
  const days = pending === 1 ? 'يومٌ واحد' : pending === 2 ? 'يومان' : `${pending} أيام`
  if (!online) return `محفوظ على جهازك — ${days} بانتظار الاتصال`
  return syncing ? `يجري الرفع — ${days}…` : `${days} بانتظار الرفع`
}
