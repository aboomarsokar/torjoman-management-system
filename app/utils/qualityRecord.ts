/**
 * سجلُّ تقييم الجودة الشهريّ للمعلم (قرارات المستخدم 2026-10-21) — قراءةُ أرقامه كما تحسبها القاعدة
 * (`private.quality_month_compute`، وتُثبَّت في `teacher_quality_months.numbers` عند الحفظ)، وحالُ السجلّ،
 * وتنسيقُ الدرجات. الحسابُ نفسُه في القاعدة وحدها؛ هنا العرضُ. مختبَرةٌ في qualityRecord.test.ts.
 */
import type { Database } from '~/types/database.types'

export type QualityRow = Database['public']['Tables']['teacher_quality_months']['Row']

/** حلقةٌ في قائمة السجلّ: معلّمُها ومشرفُها. */
export interface QualityHalaqa {
  id: string
  name: string
  supervisor_id: string | null
  teacher: { id: string, full_name: string } | null
  supervisor: { full_name: string } | null
}

export const QUALITY_MAX = 50
export const ACHIEVEMENT_MAX = 50
export const FINAL_MAX = 100
export const MEETINGS_MAX = 8
export const REPORTS_QURAN_MAX = 5
export const REPORTS_STATEMENT_MAX = 3

export interface QualityVisit { id: string, date: string, score: number, criteria: number[] }

export interface QualityNumbers {
  visits: QualityVisit[]
  visits_count: number
  visits_avg: number | null
  visits_part: number | null
  reports_quran: number
  reports_statement: number
  reports_deadline: string
  meetings: number | null
  quality: number | null
  achievement_done: number
  achievement_short: number
  achievement_unrecorded: number
  achievement_unmeasured: number
  achievement: number | null
  final: number | null
  incomplete: boolean
  /** المعاينةُ وحدها: يومُ إتاحة الرصد. */
  opens_on?: string
}

/** يقرأ jsonb الأرقام بأمان (الأعدادُ قد تصل نصوصاً من numeric). */
export function parseNumbers(raw: unknown): QualityNumbers | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
  const visits = Array.isArray(r.visits) ? (r.visits as Record<string, unknown>[]) : []
  return {
    visits: visits.map(v => ({
      id: String(v.id ?? ''), date: String(v.date ?? ''), score: Number(v.score ?? 0),
      criteria: Array.isArray(v.criteria) ? (v.criteria as unknown[]).map(Number) : []
    })),
    visits_count: Number(r.visits_count ?? 0),
    visits_avg: num(r.visits_avg),
    visits_part: num(r.visits_part),
    reports_quran: Number(r.reports_quran ?? 0),
    reports_statement: Number(r.reports_statement ?? 0),
    reports_deadline: String(r.reports_deadline ?? ''),
    meetings: num(r.meetings),
    quality: num(r.quality),
    achievement_done: Number(r.achievement_done ?? 0),
    achievement_short: Number(r.achievement_short ?? 0),
    achievement_unrecorded: Number(r.achievement_unrecorded ?? 0),
    achievement_unmeasured: Number(r.achievement_unmeasured ?? 0),
    achievement: num(r.achievement),
    final: num(r.final),
    incomplete: !!r.incomplete,
    ...(r.opens_on ? { opens_on: String(r.opens_on) } : {})
  }
}

/** الدرجةُ بلا أصفارٍ زائدة: 39.00 ← «39»، 36.5 ← «36.5»، وnull ← «—». */
export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return String(Math.round(n * 100) / 100)
}

/** تقييمُ الجودة بدرجة اجتماعاتٍ يكتبها المدير الإداري الآن (المعاينةُ تحسبها صفراً): (الزيارات + التقارير + الاجتماعات) ÷ 2. */
export function qualityWith(n: QualityNumbers, meetings: number): number | null {
  if (n.visits_part === null) return null
  return Math.round(((n.visits_part + n.reports_quran + n.reports_statement + meetings) / 2) * 100) / 100
}

export type QualityState = 'none' | 'open' | 'locked' | 'acknowledged'

/** حالُ سجلّ الشهر: لم يُرصد · فُتح للتعديل · مقفل بانتظار اطّلاع المعلم · اطّلع المعلم. */
export function qualityState(rec: { locked_at: string | null, teacher_ack_at: string | null } | null): QualityState {
  if (!rec) return 'none'
  if (!rec.locked_at) return 'open'
  return rec.teacher_ack_at ? 'acknowledged' : 'locked'
}

export const QUALITY_STATE_META: Record<QualityState, { label: string, color: 'neutral' | 'warning' | 'info' | 'success' }> = {
  none: { label: 'لم يُرصد', color: 'neutral' },
  open: { label: 'مفتوحٌ للتعديل', color: 'warning' },
  locked: { label: 'بانتظار اطّلاع المعلم', color: 'info' },
  acknowledged: { label: 'اطّلع المعلم', color: 'success' }
}
