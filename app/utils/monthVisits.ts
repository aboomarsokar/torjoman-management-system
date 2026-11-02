/**
 * زياراتُ الشهر لكلّ حلقة في «متابعة الرصد» (طلب المستخدم 2026-11-02): المنفّذةُ بالنموذج (لها علامة) في شهر موعدها
 * بتوقيت غزة، **أيًّا كان الزائر** (المشرف الميدانيّ أو المدير الفنيّ أو المديرة الإدارية) — كما يحسبها سجلُّ الجودة.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { gazaDayOf } from '~/utils/visitStatus'

/** زيارتان في الشهر لكلّ حلقة (زيارتا سجلّ تقييم الجودة). */
export const VISITS_PER_MONTH = 2

export interface VisitRow {
  halaqa_id: string
  score: number | null
  executed_at: string | null
  scheduled_at: string
  visitor: { full_name: string } | null
}

export interface HalaqaVisits {
  /** المنفّذةُ بعلامة، بترتيب التنفيذ. */
  done: { day: string, score: number, visitor: string | null }[]
  /** المجدولةُ في الشهر ولم تُنفَّذ. */
  pending: number
  avg: number | null
}

/** يجمع زيارات الشهر (`YYYY-MM`) لكلّ حلقة. */
export function groupMonthVisits(rows: VisitRow[], month: string): Map<string, HalaqaVisits> {
  const out = new Map<string, HalaqaVisits>()
  const sorted = [...rows].sort((a, b) => (a.executed_at ?? a.scheduled_at).localeCompare(b.executed_at ?? b.scheduled_at))
  for (const v of sorted) {
    if (!gazaDayOf(v.scheduled_at).startsWith(month)) continue
    const h = out.get(v.halaqa_id) ?? { done: [], pending: 0, avg: null }
    if (v.executed_at && v.score !== null) h.done.push({ day: gazaDayOf(v.executed_at), score: Number(v.score), visitor: v.visitor?.full_name ?? null })
    else if (!v.executed_at) h.pending++
    out.set(v.halaqa_id, h)
  }
  for (const h of out.values()) {
    h.avg = h.done.length ? Math.round((h.done.reduce((s, d) => s + d.score, 0) / h.done.length) * 10) / 10 : null
  }
  return out
}

/** حدودُ استعلام الشهر بهامش يومٍ لفرق التوقيت (الفرزُ الدقيق بتوقيت غزة في `groupMonthVisits`). */
export function monthQueryRange(year: number, month: number): { from: string, to: string } {
  const from = new Date(Date.UTC(year, month - 1, 1) - 86400000).toISOString()
  const to = new Date(Date.UTC(year, month, 1) + 86400000).toISOString()
  return { from, to }
}

/** يقرأ زياراتِ الشهر التي تسمح بها RLS (نطاقُ القارئ) ويجمعها لكلّ حلقة — يرمي الخطأ. */
export async function fetchMonthVisits(supabase: SupabaseClient<Database>, year: number, month: number): Promise<Map<string, HalaqaVisits>> {
  const range = monthQueryRange(year, month)
  const { data, error } = await supabase.from('supervision_visits')
    .select('halaqa_id, score, executed_at, scheduled_at, visitor:profiles!supervision_visits_supervisor_id_fkey(full_name)')
    .gte('scheduled_at', range.from).lt('scheduled_at', range.to)
  if (error) throw error
  return groupMonthVisits((data ?? []) as VisitRow[], `${year}-${String(month).padStart(2, '0')}`)
}
