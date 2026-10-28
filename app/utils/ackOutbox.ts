/**
 * «أُقِرّ بالاطّلاع» بلا إنترنت (البند 14، الدفعة الأولى — 2026-10-27): نتيجةُ زيارةٍ، أو سجلُّ التقييم الشهريّ، أو
 * تنبيهٌ إداريّ. يُحفظ الإقرارُ على الجهاز وتُعدَّل نسخةُ الشاشة فيظهر «اطّلعتَ» فوراً، ويُرفع حين يعود الاتصال
 * (`offlineQueues` — دوالُّ الإقرار تقبل التكرار، فالإعادةُ آمنة). دوالُّ نقيّةٌ مختبَرة.
 */
import type { QueueEntry } from '~/composables/useOfflineQueue'
import { SCREEN_KEYS } from '~/utils/teacherScreens'

export type AckKind = 'visit' | 'quality' | 'alert'

export interface AckEntry extends QueueEntry {
  kind: AckKind
  /** معرّفُ الزيارة أو السجلّ أو التنبيه. */
  id: string
}

export function newAckEntry(uid: string, kind: AckKind, id: string, now: Date = new Date()): AckEntry {
  return { key: `${uid}|${kind}|${id}`, uid, kind, id, recordedAt: now.toISOString(), attempts: 0, status: 'pending' }
}

type Row = { id: string }

/** مفتاحُ نسخة الشاشة التي يظهر فيها الإقرار — وللتقييم شهرُ السجلّ. */
export function ackSnapshotKey(kind: AckKind, month?: { year: number, month: number }): string {
  if (kind === 'visit') return SCREEN_KEYS.visits
  if (kind === 'alert') return SCREEN_KEYS.alerts
  return SCREEN_KEYS.qualityRecords(month!.year, month!.month)
}

/** يعلّم السطرَ «مُطّلَعاً عليه» في نسخة الشاشة كما تفعل القاعدةُ عند الرفع. */
export function markAcknowledged<T extends Row>(rows: T[], kind: AckKind, id: string, at: string): T[] {
  return rows.map((r) => {
    if (r.id !== id) return r
    return kind === 'alert' ? { ...r, status: 'acknowledged', acknowledged_at: at } : { ...r, teacher_ack_at: at }
  })
}
