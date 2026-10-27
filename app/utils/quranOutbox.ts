/**
 * الإنجازُ القرآنيّ بلا إنترنت (البند 14 — نمطُ الصحابة، 2026-10-27): سطرُ صندوق الرفع (سجلُّ طالبٍ لشهر)، ونسخةُ
 * الجهاز لشهرٍ واحد، ودمجُ ما ينتظر الرفعَ في سجلّات الشهر كي تُبنى الصفوفُ كأنّه رُفع. دوالُّ نقيّةٌ مختبَرة.
 */
import type { QueueEntry } from '~/composables/useOfflineQueue'
import type { QuranRecordRow } from '~/utils/quran/month'
import type { MonthInputs } from '~/utils/quran/monthInputs'
import type { RecordInput } from '~/utils/quran/screen'

export interface QuranEntry extends QueueEntry {
  halaqaId: string
  year: number
  month: number
  studentId: string
  input: RecordInput
}

/** نسخةُ شهرٍ لحلقة المعلّم على الجهاز — مدخلاتُ `buildStudentRows` كما جاءت من القاعدة. */
export interface QuranMirror {
  /** `uid|YYYY-MM` */
  key: string
  uid: string
  halaqa: { id: string, name: string } | null
  year: number
  month: number
  inputs: MonthInputs | null
  syncedAt: string
}

export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
export const quranMirrorKey = (uid: string, year: number, month: number) => `${uid}|${monthKey(year, month)}`

/** سجلُّ طالبٍ للشهر يُحفظ على الجهاز — آخرُ حفظٍ يغلب ما قبله (مفتاحٌ واحدٌ للطالب في الشهر). */
export function newQuranEntry(
  uid: string, halaqaId: string, year: number, month: number, studentId: string, input: RecordInput, now: Date = new Date()
): QuranEntry {
  return {
    key: `${uid}|${halaqaId}|${monthKey(year, month)}|${studentId}`,
    uid, halaqaId, year, month, studentId, input,
    recordedAt: now.toISOString(), attempts: 0, status: 'pending'
  }
}

/** صفُّ القاعدة لسجلٍّ محفوظٍ على الجهاز — فوق الموجود إن كان، وإلا بمعرّفٍ محلّيّ (`id` بعد الرفع). */
export function entryAsRecord(entry: QuranEntry, existing: QuranRecordRow | undefined, id?: string): QuranRecordRow {
  const { from, to, pagesMemorized, pagesReviewed, notes } = entry.input
  return {
    created_at: existing?.created_at ?? entry.recordedAt,
    recorded_by: existing?.recorded_by ?? entry.uid,
    report_id: existing?.report_id ?? '',
    student_id: entry.studentId,
    id: id ?? existing?.id ?? `local:${entry.studentId}`,
    from_surah: from?.surah ?? null,
    from_ayah: from?.ayah ?? null,
    to_surah: to?.surah ?? null,
    to_ayah: to?.ayah ?? null,
    pages_memorized: pagesMemorized,
    pages_reviewed: pagesReviewed,
    notes: notes?.trim() || null,
    recorded_at: entry.recordedAt,
    updated_at: entry.recordedAt
  }
}

/** سجلّاتُ الشهر بعد دمج ما ينتظر الرفعَ (المرفوضُ لا يُدمج — يبقى ما في القاعدة). */
export function overlayRecords(records: QuranRecordRow[], entries: QuranEntry[]): QuranRecordRow[] {
  const pending = new Map(entries.filter(e => e.status === 'pending').map(e => [e.studentId, e]))
  const merged = records.map((r) => {
    const e = pending.get(r.student_id)
    return e ? entryAsRecord(e, r) : r
  })
  const present = new Set(records.map(r => r.student_id))
  for (const e of pending.values()) if (!present.has(e.studentId)) merged.push(entryAsRecord(e, undefined))
  return merged
}

/** عددُ السجلّات بالعربية: سجلٌّ واحد · سجلّان · 3 سجلّات · 11 سجلّاً. */
export function recordsCount(n: number): string {
  if (n === 1) return 'سجلٌّ واحد'
  if (n === 2) return 'سجلّان'
  return n <= 10 ? `${n} سجلّات` : `${n} سجلّاً`
}

/** لماذا لا يُرسَل الشهر — null إن جاز (والقاعدةُ تحكم بعده). */
export function offlineSubmitBlock(input: { online: boolean, pending: number, windowBlock: string | null }): string | null {
  if (!input.online) return 'الإرسالُ يحتاج اتصالاً.'
  if (input.pending) return `ينتظر ${recordsCount(input.pending)} الرفعَ قبل الإرسال.`
  return input.windowBlock
}
