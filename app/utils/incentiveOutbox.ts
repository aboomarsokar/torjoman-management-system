/**
 * كشفُ الحوافز بلا إنترنت (البند 14، الدفعة الثانية — 2026-10-28): نسخةُ الشهر على جهاز المعلّم (المخصّصُ والكشفُ
 * وبنودُه)، وسطرُ صندوق الرفع = **مسوّدةُ الشهر كاملةً** (البنودُ كلُّها؛ آخرُ حفظٍ يغلب ما قبله)، ورفعُها بطريق الحفظ
 * المتّصل نفسِه: الكشفُ مسوّدةً إن لم يكن، ثمّ البنودُ الجديدة، ثمّ حذفُ القديمة — فإن تعثّر في منتصفه أُعيد كلُّه بلا ضرر.
 * والإرسالُ للمراجعة متّصلاً وحده وبعد الرفع. دوالُّ نقيّةٌ مختبَرة.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QueueEntry } from '~/composables/useOfflineQueue'
import type { Database } from '~/types/database.types'

type StatementStatus = Database['public']['Enums']['statement_status']

export interface IncentiveItem { description: string, category: string, amount: number, item_date: string }

export interface IncentiveSnapshot {
  allocated: number
  statement: { id: string, status: StatementStatus, returnNote: string | null } | null
  items: IncentiveItem[]
}

export interface IncentiveEntry extends QueueEntry {
  halaqaId: string
  year: number
  month: number
  items: IncentiveItem[]
}

/** مفتاحُ حلقة المعلّم في الصفحة (جلبُها ونسختُها على الجهاز). */
export const INCENTIVE_HALQA_KEY = 'inc-my-halqa'

/** مفتاحُ نسخة الشهر على الجهاز (حلقةُ المعلّم واحدة). */
export const incentiveSnapshotKey = (year: number, month: number) => `incentive-statement|${year}-${month}`

export function newIncentiveEntry(uid: string, halaqaId: string, year: number, month: number, items: IncentiveItem[], now: Date = new Date()): IncentiveEntry {
  return {
    key: `${uid}|${halaqaId}|${year}-${String(month).padStart(2, '0')}`,
    uid, halaqaId, year, month, items,
    recordedAt: now.toISOString(), attempts: 0, status: 'pending'
  }
}

/**
 * لماذا لا يُرسَل الكشف — null إن جاز. الإرسالُ متّصلاً وحده؛ ومسوّدةٌ على الجهاز تُرفع بالحفظ الذي يسبق الإرسال
 * (فإن لم تصل القاعدةَ لم يُرسَل).
 */
export function incentiveSubmitBlock(online: boolean): string | null {
  return online ? null : 'الإرسالُ للمراجعة يحتاج اتصالاً — احفظ الكشفَ على جهازك الآن، وأرسله حين يعود الاتصال.'
}

type Client = SupabaseClient<Database>
type UploadResult = { data: unknown, error: { code?: string | null, message?: string | null } | null }

/** كشفُ الشهر كما في القاعدة — الشاشةُ متّصلةً، وتهيئةُ نسخة الجهاز. يرمي خطأ القاعدة. */
export async function fetchIncentiveStatement(supabase: Client, halaqaId: string, year: number, month: number): Promise<IncentiveSnapshot & { itemIds: string[] }> {
  const [alloc, st] = await Promise.all([
    supabase.from('halaqa_incentives').select('allocated_amount').eq('halaqa_id', halaqaId).eq('incentive_month', month).eq('incentive_year', year).maybeSingle(),
    supabase.from('incentive_statements').select('id, status, return_note').eq('halaqa_id', halaqaId).eq('statement_month', month).eq('statement_year', year).maybeSingle()
  ])
  if (alloc.error || st.error) throw alloc.error ?? st.error
  let rows: { id: string, description: string | null, category: string | null, amount: number, item_date: string | null }[] = []
  if (st.data) {
    const { data, error } = await supabase.from('incentive_statement_items').select('id, description, category, amount, item_date').eq('statement_id', st.data.id).order('item_date')
    if (error) throw error
    rows = data ?? []
  }
  return {
    allocated: alloc.data?.allocated_amount ?? 0,
    statement: st.data ? { id: st.data.id, status: st.data.status, returnNote: st.data.return_note } : null,
    items: rows.map(r => ({ description: r.description ?? '', category: r.category ?? '', amount: r.amount, item_date: r.item_date ?? '' })),
    itemIds: rows.map(r => r.id)
  }
}

/** نسخةُ الشهر بعد رفع مسوّدته: البنودُ المرفوعة، والكشفُ مسوّدةٌ قائمة. */
export function settledSnapshot(snap: IncentiveSnapshot, e: IncentiveEntry, statementId: string): IncentiveSnapshot {
  return { ...snap, statement: snap.statement ?? { id: statementId, status: 'draft', returnNote: null }, items: e.items }
}

const findStatement = (supabase: Client, e: IncentiveEntry) => supabase.from('incentive_statements').select('id, status')
  .eq('halaqa_id', e.halaqaId).eq('statement_month', e.month).eq('statement_year', e.year).maybeSingle()

/** رفعُ مسوّدة الشهر — بطريق الحفظ المتّصل نفسِه، ويُعاد كلُّه إن تعثّر (البنودُ تُستبدل). */
export async function uploadIncentiveDraft(supabase: Client, e: IncentiveEntry): Promise<UploadResult> {
  let stQ = await findStatement(supabase, e)
  if (stQ.error) return { data: null, error: stQ.error }
  let sid = stQ.data?.id
  if (!sid) {
    const alloc = await supabase.from('halaqa_incentives').select('allocated_amount')
      .eq('halaqa_id', e.halaqaId).eq('incentive_month', e.month).eq('incentive_year', e.year).maybeSingle()
    if (alloc.error) return { data: null, error: alloc.error }
    const ins = await supabase.from('incentive_statements')
      .insert({ halaqa_id: e.halaqaId, statement_month: e.month, statement_year: e.year, received_amount: alloc.data?.allocated_amount ?? 0, status: 'draft', created_by: e.uid })
      .select('id').single()
    sid = ins.data?.id
    // سبقه إنشاءٌ آخر (فريدٌ على الحلقة والشهر — حفظٌ من جهازٍ آخر): يُقرأ ما أُنشئ ويُكمَل عليه
    if (ins.error) {
      if (ins.error.code !== '23505') return { data: null, error: ins.error }
      stQ = await findStatement(supabase, e)
      if (stQ.error || !stQ.data) return { data: null, error: stQ.error ?? ins.error }
      sid = stQ.data.id
    }
  }
  if (stQ.data && stQ.data.status !== 'draft') {
    return { data: null, error: { code: 'P0001', message: 'أُرسل كشفُ هذا الشهر للمراجعة — لا يُعدَّل إلا إن أُعيد إليك.' } }
  }
  if (!sid) return { data: null, error: { code: 'retry', message: 'تعذّر إنشاءُ الكشف.' } }
  const old = await supabase.from('incentive_statement_items').select('id').eq('statement_id', sid)
  if (old.error) return { data: null, error: old.error }
  if (e.items.length) {
    const r = await supabase.from('incentive_statement_items').insert(e.items.map(i => ({ ...i, statement_id: sid })))
    if (r.error) return { data: null, error: r.error }
  }
  const oldIds = (old.data ?? []).map(o => o.id)
  if (oldIds.length) {
    const d = await supabase.from('incentive_statement_items').delete().in('id', oldIds)
    if (d.error) return { data: null, error: d.error }
  }
  return { data: sid, error: null }
}
