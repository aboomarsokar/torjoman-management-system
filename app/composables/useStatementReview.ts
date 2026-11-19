import type { Database } from '~/types/database.types'

/**
 * الاطّلاعُ على كشوف حوافزٍ مُرسَلة دفعةً واحدة: طلبٌ واحد يقصر التحديثَ على المُرسَل (فلا يُعاد
 * مراجَعٌ ولا تُمسّ مسوّدة)، ويُرجع ما تمّ فعلاً. الترحيلُ إلى الشهر التالي تجريه مشغّلاتُ القاعدة لكلّ كشف،
 * والصلاحيةُ يحكمها حارسُ `guard_statement_status`.
 */
export function useStatementReview() {
  const supabase = useSupabaseClient<Database>()

  async function reviewMany(ids: string[], reviewerId: string | null): Promise<string[]> {
    if (!ids.length) return []
    const { data, error } = await supabase.from('incentive_statements')
      .update({ status: 'reviewed', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .in('id', ids).eq('status', 'submitted').select('id')
    if (error) throw error
    return (data ?? []).map(r => r.id)
  }

  return { reviewMany }
}
