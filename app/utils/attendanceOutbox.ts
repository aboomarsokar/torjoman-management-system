/**
 * منطقُ الحضور بلا إنترنت — نقيٌّ ومختبَر (نمطُ الصحابة، 2026-10-26).
 * كلُّ «حفظ حضور» يصير **سطراً واحداً لليوم** في صندوق الرفع (الأحدثُ يحلّ محلّ الأقدم لليوم نفسه)، ويُرفع وحده
 * بنداءٍ واحد (`save_attendance_day`) — فرفضُ يومٍ لا يحبس غيره. والشاشةُ تعرض اليومَ من الصندوق إن كان فيه،
 * وإلا من نسخة الجهاز.
 */
import { RETRY_DELAYS_MS } from '~/constants/offline'
import type { AbsenceKind } from '~/composables/useAttendanceDay'
import type { OffDay, OffReason, ShownOff } from '~/utils/offDays'

export type Absences = Record<string, AbsenceKind>

/** يومٌ في نسخة الجهاز: سُجّل (انعقدت الحلقة) وغياباتُه. */
export interface MirrorDay { held: boolean, absences: Absences }

/**
 * نوعُ سطر الصندوق (بلاغ «لم تنعقد» 2026-10-30): `attendance` ← `save_attendance_day` · `off` ← `report_off_day` ·
 * `withdraw` ← `withdraw_off_day`. اليومُ سطرٌ واحد مهما كان نوعُه والأحدثُ يغلب.
 */
export type OutboxKind = 'attendance' | 'off' | 'withdraw'

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
  /** نوعُ السطر — الغائبُ = `attendance` (سطورٌ حُفظت على الأجهزة قبل التحديث بلا هذا الحقل). */
  kind?: OutboxKind
  /** سببُ البلاغ وملاحظتُه — لسطر `off` وحده. */
  off?: { reason: OffReason, note: string | null }
}

/** نوعُ السطر؛ سطرٌ قديمٌ بلا `kind` حضورٌ كما كان. */
export function entryKind(e: OutboxEntry): OutboxKind {
  return e.kind ?? 'attendance'
}

export function entryKey(uid: string, halaqaId: string, day: string): string {
  return `${uid}|${halaqaId}|${day}`
}

export function newEntry(uid: string, halaqaId: string, day: string, absences: Absences, now: Date = new Date()): OutboxEntry {
  return { key: entryKey(uid, halaqaId, day), uid, halaqaId, day, kind: 'attendance', absences: { ...absences }, recordedAt: now.toISOString(), attempts: 0, status: 'pending' }
}

/** سطرُ بلاغ «لم تنعقد الحلقة» — نفسُ مفتاح اليوم، فيحلّ محلّ أيّ سطرٍ سابقٍ له ويحلّ محلَّه الأحدث. */
export function newOffEntry(uid: string, halaqaId: string, day: string, reason: OffReason, note: string | null, now: Date = new Date()): OutboxEntry {
  return { key: entryKey(uid, halaqaId, day), uid, halaqaId, day, kind: 'off', off: { reason, note }, absences: {}, recordedAt: now.toISOString(), attempts: 0, status: 'pending' }
}

/** سطرُ «تراجع — الحلقة انعقدت»: يسحب بلاغاً مرفوعاً عند عودة الاتصال. */
export function newWithdrawEntry(uid: string, halaqaId: string, day: string, now: Date = new Date()): OutboxEntry {
  return { key: entryKey(uid, halaqaId, day), uid, halaqaId, day, kind: 'withdraw', absences: {}, recordedAt: now.toISOString(), attempts: 0, status: 'pending' }
}

/**
 * اليومُ كما يُعرض: ما في الصندوق يغلب نسخةَ الجهاز (هو الأحدث).
 * حضور ← مسجَّل · بلاغ ← غيرُ مسجَّل وبلاغٌ «على الجهاز» · سحبٌ ← غيرُ مسجَّل بلا بلاغ · بلا سطر ← النسخة كما هي
 * مع بلاغها المرفوع (`off`) إن وُجد. `off` الغائبُ (نسخةُ جهازٍ قديمة) = لا بلاغ.
 * وبلاغٌ أو سحبٌ **رفضته القاعدة** لا يُعرض «على جهازك — بانتظار الرفع»: اليومُ كما في النسخة، والمرفوضُ في قائمة
 * «أيامٌ لم تقبلها الإدارة». أمّا حضورٌ مرفوض فيبقى معروضاً كما أدخله المعلّم — مسوّدتُه منه، فيصحّحها ويعيد حفظها.
 */
export function effectiveDay(
  mirror: MirrorDay | undefined,
  queued: OutboxEntry | undefined,
  off?: OffDay
): MirrorDay & { pending: boolean, off: ShownOff | null } {
  const entry = queued && !(entryKind(queued) !== 'attendance' && queued.status === 'rejected') ? queued : undefined
  if (entry) {
    const kind = entryKind(entry)
    if (kind === 'off' && entry.off) {
      return { held: false, absences: {}, pending: true, off: { ...entry.off, status: 'pending', reviewNote: null, queued: true } }
    }
    if (kind === 'withdraw') return { held: false, absences: {}, pending: true, off: null }
    return { held: true, absences: { ...entry.absences }, pending: true, off: null }
  }
  return {
    held: mirror?.held ?? false,
    absences: { ...(mirror?.absences ?? {}) },
    pending: false,
    off: off ? { ...off, queued: false } : null
  }
}

/** غياباتُ مَن في القائمة وحدَهم — مَن لم يعد في الحلقة لا يُرفع غيابُه. */
export function absencesFor(draft: Absences, studentIds: string[]): Absences {
  const keep = new Set(studentIds)
  return Object.fromEntries(Object.entries(draft).filter(([id]) => keep.has(id)))
}

/** غياباتٌ بعد حذف من تخطّاهم الرفع (لم يعودوا في الحلقة). */
export function keptAbsences(absences: Absences, skipped: string[]): Absences {
  const drop = new Set(skipped)
  return Object.fromEntries(Object.entries(absences).filter(([id]) => !drop.has(id)))
}

/** سببُ الرفض للمعلّم: رسائلُ حرّاس القاعدة عربيّة فتُعرض كما هي، وغيرُها (رسائلُ Postgres الإنجليزية) بجملةٍ عامّة. */
export function rejectionText(error: string | undefined): string {
  return error && /[؀-ۿ]/.test(error) ? error : 'لم تقبل القاعدةُ هذا الحفظ — أعد المحاولة، فإن تكرّر فتواصل مع الإدارة.'
}

/** رموزُ أخطاء القاعدة التي لا تُصلحها الإعادة: حارسٌ رفض، أو صلاحية، أو صيغة. */
const PERMANENT_CODES = new Set(['P0001', '42501', '22023', '23514', '23503', '23505', '22007', '22P02', 'PGRST202'])
/** انتهاءُ الرمز — يُجدَّد ثمّ يُعاد. */
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', '401'])

export type SyncFailure = 'retry' | 'reauth' | 'reject'

/** كيف يُعامَل خطأُ الرفع: يُعاد لاحقاً (شبكة/خادم)، أو يُجدَّد الدخولُ ثمّ يُعاد، أو يُرفض نهائياً. */
export function classifySyncError(err: { code?: string | null, message?: string | null } | null | undefined): SyncFailure {
  const code = err?.code ?? ''
  // «permission denied for function» = نداءٌ بلا جلسة (الدالّةُ ممنوحةٌ لـauthenticated وحده) لا رفضٌ للمعلّم
  // (بلاغ المستخدم بلقطة 2026-10-27: يومٌ «لم تقبله الإدارة» رُفع وصفحةُ الدخول مفتوحة)
  if (AUTH_CODES.has(code) || /jwt expired|invalid jwt|permission denied for function/i.test(err?.message ?? '')) return 'reauth'
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
 * `count` يعدّ ما في الصندوق (الأيامُ افتراضاً، والسجلّاتُ في الإنجاز القرآنيّ).
 */
export function syncStatusLine(
  s: { online: boolean, pending: number, rejected: number, syncing: boolean, syncedAt: string | null },
  count: (n: number) => string = daysCount
): string {
  if (s.rejected) return `${count(s.rejected)} لم تقبله الإدارة — راجِعه أدناه`
  if (s.pending) {
    if (!s.online) return `${count(s.pending)} محفوظ على جهازك — يُرفع حين يعود الاتصال`
    return s.syncing ? `يجري رفع ${count(s.pending)}…` : `${count(s.pending)} بانتظار الرفع — يُرفع تلقائياً`
  }
  const fresh = s.syncedAt ? ` · البيانات محدَّثة ${s.syncedAt}` : ''
  return s.online ? `كلُّ شيءٍ مرفوع${fresh}` : `بلا اتصال${fresh} — ما تسجّله يُحفظ على جهازك`
}
