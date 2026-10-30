/**
 * صندوقُ رفع تقييم الزيارة بلا إنترنت (الدفعة الثالثة — 2026-10-29): المشرفُ الميداني يملأ نموذجَ الزيارة على جهازه،
 * وسطرُ الصندوق = **ما يُرقَّع به الصفّ** (يومُ التنفيذ وأعدادُ البنود والملاحظات)، ويُرفع بالتحديث نفسِه الذي يحفظ به المتّصل
 * (القاعدةُ تحسب المجموعَ وتُقفل: `visit_score_and_lock`). دوالُّ نقيّةٌ مختبَرة.
 * **يومُ التنفيذ يُثبَّت ساعةَ الحفظ على الجهاز** لا ساعةَ الرفع — حفظٌ قبل منتصف الليل ورفعٌ بعده يبقى يومَ الحفظ.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QueueEntry } from '~/composables/useOfflineQueue'
import type { Database } from '~/types/database.types'
import type { VisitRow } from '~/types/visits'
import { groupCriteria, visitTotals, type DeductionCounts, type DeductionItem } from '~/utils/visitForm'

export interface VisitEntry extends QueueEntry {
  visitId: string
  /** يومُ التنفيذ كما ثُبّت عند الحفظ (ISO بتوقيت غزة، من `executedAtFromDay`). */
  executedAt: string
  deductions: DeductionCounts
  notes: string | null
}

export function newVisitEntry(uid: string, visitId: string, input: { executedAt: string, deductions: DeductionCounts, notes: string | null }, now: Date = new Date()): VisitEntry {
  return {
    key: `${uid}|${visitId}`,
    uid, visitId,
    executedAt: input.executedAt, deductions: input.deductions, notes: input.notes,
    recordedAt: now.toISOString(), attempts: 0, status: 'pending'
  }
}

/** رفضٌ دائم: التحديثُ لم يمسّ صفّاً (ليست زيارتَه — يمنعها RLS — أو حُذفت). */
export const VISIT_NOT_SAVED = 'لم تُحفظ الزيارة — ليست ضمن صلاحيتك أو حُذفت.'

/** أعمدةُ الصفّ بعد الحفظ (القاعدةُ حسبت المجموعَ وأقفلت) — ما يُرقَّع به صفُّ النسخة. */
export const VISIT_RESULT_COLUMNS = 'id, executed_at, locked_at, score, deductions, notes, status'

type Client = SupabaseClient<Database>
type UploadResult = { data: unknown, error: { code?: string, message?: string } | null }

/** رفعُ نتيجة الزيارة — يومُ التنفيذ من السطر لا من الساعة. بلا صفوفٍ = رفضٌ دائم (`42501`). */
export async function uploadVisitResult(supabase: Client, e: VisitEntry): Promise<UploadResult> {
  const { data, error } = await supabase.from('supervision_visits').update({
    executed_at: e.executedAt,
    deductions: e.deductions,
    notes: e.notes
  }).eq('id', e.visitId).select(VISIT_RESULT_COLUMNS)
  if (error) return { data: null, error }
  if (!data?.length) return { data: null, error: { code: '42501', message: VISIT_NOT_SAVED } }
  return { data: data[0], error: null }
}

/** نسخةُ الزيارات بعد الرفع: يُدمج `patch` في الصفّ المطابق وحده. */
export function settledVisits(rows: VisitRow[], visitId: string, patch: Partial<VisitRow>): VisitRow[] {
  return rows.map(r => r.id === visitId ? { ...r, ...patch } : r)
}

/**
 * الزياراتُ كما تُعرض والمعلَّقُ على الجهاز مطبَّقٌ عليها: النتيجةُ من السطر، والمجموعُ من 42 يُحسب محلّياً بالبنود،
 * (فارغٌ إن غابت البنودُ عن الجهاز) و`locked_at` وقتُ الحفظ — فيراها المشرفُ مقفلةً للقراءة بعدّه وملاحظاته لا فارغةً ولا قابلةً للتعديل.
 */
export function applyPendingVisits(rows: VisitRow[], entries: VisitEntry[], items: DeductionItem[]): VisitRow[] {
  if (!entries.length) return rows
  const byVisit = new Map(entries.map(e => [e.visitId, e]))
  const criteria = groupCriteria(items)
  return rows.map((r) => {
    const e = byVisit.get(r.id)
    if (!e) return r
    return {
      ...r,
      executed_at: e.executedAt,
      deductions: e.deductions,
      notes: e.notes,
      // بلا بنودٍ على الجهاز لا معاييرَ يُحسب بها المجموع: فارغٌ لا رقمٌ مضلِّل (تحسبه القاعدةُ عند الرفع)
      score: items.length ? visitTotals(criteria, e.deductions).score : null,
      locked_at: e.recordedAt
    }
  })
}
