import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import { midmonthSummary, type MidHalaqa } from '~/utils/quran/midmonth'
import { monthBounds } from '~/utils/transport'

/**
 * متابعةُ رصد منتصف الشهر (طلب المستخدم 2026-11-21): الحلقاتُ النشطة التي يراها المستخدم (RLS: الإداريُّ الكلّ، والفنيُّ
 * البنين، والمديرةُ البنات، والمشرفُ حلقاتِه، ومشرفُ المشروع قراءةً)، وصورُ المنتصف المسلَّمة وسجلّاتُها، وطلابُ الحلقات،
 * وهدفُ الشهر، واختباراتُ الشهر (من اختُبر قبل التسليم يُخفَّض حدُّه — 2026-11-22) — ثم `midmonthSummary`.
 */
export function useMidmonthFollowup(year: Ref<number>, month: Ref<number>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()

  const { data, pending } = useLazyAsyncData(() => `midmonth-${year.value}-${month.value}`, async () => {
    const { from, to } = monthBounds(year.value, month.value)
    const [halaqat, heads, students, settings, exams] = await Promise.all([
      supabase.from('halaqat').select('id, name, gender, teacher:profiles!halaqat_teacher_id_fkey(full_name)').eq('status', 'active').order('name'),
      supabase.from('quran_midmonth').select('report_id, halaqa_id, submitted_at').eq('mid_year', year.value).eq('mid_month', month.value),
      supabase.from('students').select('id, halaqa_id, full_name').eq('status', 'active').not('halaqa_id', 'is', null),
      supabase.from('app_settings').select('target_memorization_pages').eq('id', 1).maybeSingle(),
      supabase.from('exam_results').select('student_id, exam_date, item:exam_list_items!inner(cycle:exam_cycles(parts_from, parts_to))').gte('exam_date', from).lt('exam_date', to)
    ])
    const failure = halaqat.error ?? heads.error ?? students.error ?? settings.error ?? exams.error
    if (failure) {
      handle(failure)
      return null
    }
    const reportIds = (heads.data ?? []).map(h => h.report_id)
    const records = reportIds.length
      ? await supabase.from('quran_mid_records').select('halaqa_id, student_id, pages_memorized').in('report_id', reportIds)
      : { data: [], error: null }
    if (records.error) {
      handle(records.error)
      return null
    }
    const list: (MidHalaqa & { gender: string | null })[] = (halaqat.data ?? []).map(h => ({
      id: h.id, name: h.name, gender: h.gender, teacher: h.teacher?.full_name ?? null
    }))
    const monthTarget = settings.data?.target_memorization_pages ?? 0
    return {
      monthTarget,
      genders: new Map(list.map(h => [h.id, h.gender])),
      ...midmonthSummary({
        halaqat: list,
        heads: heads.data ?? [],
        records: records.data ?? [],
        students: (students.data ?? []).map(s => ({ id: s.id, halaqa_id: s.halaqa_id!, full_name: s.full_name })),
        monthTarget,
        exams: (exams.data ?? []).map(e => ({
          student_id: e.student_id,
          exam_date: e.exam_date,
          parts: e.item?.cycle ? e.item.cycle.parts_to - e.item.cycle.parts_from + 1 : 0
        }))
      })
    }
  }, { server: false, default: () => null, watch: [year, month] })

  return { data, pending }
}
