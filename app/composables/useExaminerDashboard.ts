/**
 * بياناتُ لوحة المختبِر — خطوةٌ واحدة بالتوازي: حلقاتُه (`halaqat.examiner_id`) وبنودُ الترشيح في نطاقه بنتائجها،
 * ورحلاتُ مواصلاته في الشهر. الحساباتُ في `utils/examinerDashboard.ts` (نقيّة ومختبَرة)، والنطاقُ لـRLS.
 */
import type { Database } from '~/types/database.types'
import type { ExaminerHalaqa, ExaminerItem } from '~/utils/examinerDashboard'
import { halaqaBreakdown, monthGrading, examinerQueue } from '~/utils/examinerDashboard'
import { gazaToday } from '~/utils/reportWindow'

/** حدُّ البنود المقروءة — طابورُ الرصد نفسُه يقف عند 500. */
const ITEMS_LIMIT = 1000

type RawItem = {
  id: string
  created_at: string
  exam_list: { halaqa_id: string } | null
  exam_results: { passed: boolean | null, total_score: number | null, exam_date: string }[]
}
type RawHalaqa = { id: string, name: string, teacher: { full_name: string } | null }

export function useExaminerDashboard() {
  const supabase = useSupabaseClient<Database>()
  const { profile } = useProfile()
  const { handle } = useErrorHandler()

  async function load() {
    const me = profile.value?.id
    if (!me) return null
    const today = gazaToday()
    const ym = today.slice(0, 7)
    const [halqat, items, trips] = await Promise.all([
      supabase.from('halaqat').select('id, name, teacher:teacher_id(full_name)')
        .eq('examiner_id', me).eq('status', 'active').order('name').returns<RawHalaqa[]>(),
      supabase.from('exam_list_items')
        .select('id, created_at, exam_list:exam_list_id(halaqa_id), exam_results(passed, total_score, exam_date)')
        .not('exam_cycle_id', 'is', null)
        .order('created_at', { ascending: false }).limit(ITEMS_LIMIT).returns<RawItem[]>(),
      supabase.from('transport_trips').select('amount, paid')
        .eq('profile_id', me).gte('trip_date', `${ym}-01`).lte('trip_date', `${ym}-31`)
    ])
    const failure = halqat.error ?? items.error ?? trips.error
    if (failure) throw failure

    const hs: ExaminerHalaqa[] = (halqat.data ?? []).map(h => ({ id: h.id, name: h.name, teacher: h.teacher?.full_name ?? '—' }))
    const its: ExaminerItem[] = (items.data ?? []).map(i => ({
      id: i.id, created_at: i.created_at, halaqa_id: i.exam_list?.halaqa_id ?? null, result: i.exam_results[0] ?? null
    }))
    const tripRows = trips.data ?? []
    return {
      halqat: hs,
      queue: examinerQueue(its, today),
      month: monthGrading(its, ym),
      byHalaqa: halaqaBreakdown(hs, its, ym),
      trips: { count: tripRows.length, unpaid: tripRows.filter(t => !t.paid).length },
      ym
    }
  }

  const { data, pending } = useLazyAsyncData('examiner-dashboard', async () => {
    try {
      return await load()
    } catch (err) {
      handle(err, 'تعذّر تحميل لوحتك. حاول مجدداً.')
      return null
    }
  }, { server: false, default: () => null, watch: [() => profile.value?.id] })

  return { dash: data, pending }
}
