import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'
import { PUBLIC_CYCLE_COLUMNS, toExamCycle } from '~/utils/exams/cycles'
import { toProgramJuz } from '~/utils/quran/position'
import { juzReached, toMonthHistory, totalPages } from '~/utils/quran/studentHistory'
import type { ApprovedMonth } from '~/utils/quran/studentHistory'

/**
 * رابط اطّلاع الطالب (عام، بلا حساب) — يجلب الطالب بالـ view_token بصلاحية الخدمة
 * ويُرجِع حقولاً آمنة فقط (دون رقم الهوية/الجوالات/البريد — خصوصية).
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    throw createError({ statusCode: 400, statusMessage: 'رمز غير صالح.' })
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await admin
    .from('students')
    .select('id, full_name, status, quran_parts, tajweed_level, enrollment_date, halaqa:halaqa_id(name, daily_time, teacher:teacher_id(full_name))')
    .eq('view_token', token)
    .single()

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'الرابط غير صحيح أو لم يعد متاحاً.' })
  }

  // دوراتُ الاختبار + نتائج الطالب لرسم رحلة الطالب (دون surahs_label: الصفحة لا تعرضه)
  const { data: cycles, error: cyclesError } = await admin
    .from('exam_cycles')
    .select(PUBLIC_CYCLE_COLUMNS)
    .order('sort_order')
  if (cyclesError) console.error('[public/student] فشل جلب دورات الاختبار:', cyclesError.message)

  const { data: rawResults } = await admin
    .from('exam_results')
    .select('passed, total_score, exam_list_item:exam_list_item_id(exam_cycle_id)')
    .eq('student_id', data.id)

  const results = (rawResults ?? []).map((r: { passed: boolean | null, total_score: number | null, exam_list_item: { exam_cycle_id: number | null } | null }) => ({
    exam_cycle_id: r.exam_list_item?.exam_cycle_id ?? null,
    passed: r.passed,
    total_score: r.total_score
  }))

  // الشهورُ المعتمَدة من سجلّات القرآن: صفحاتُها وسطورُ السجلّ وأجزاءُ البرنامج المكتملة
  const { data: recordRows } = await admin
    .from('quran_records')
    .select('from_surah, from_ayah, to_surah, to_ayah, pages_memorized, report:report_id!inner(status, report_year, report_month)')
    .eq('student_id', data.id)
    .eq('report.status', 'approved')
    .returns<(Omit<ApprovedMonth, 'report_year' | 'report_month'> & { report: { status: string, report_year: number, report_month: number } | null })[]>()
  const months: ApprovedMonth[] = (recordRows ?? []).flatMap(({ report, ...r }) =>
    report?.status === 'approved' ? [{ ...r, report_year: report.report_year, report_month: report.report_month }] : [])
  const [{ data: surahRows }, { data: juzRows }] = await Promise.all([
    admin.from('surahs').select('number, name'),
    admin.from('program_juz').select('number, start_surah, start_ayah, end_surah, end_ayah')
  ])
  const surahNames = new Map((surahRows ?? []).map(r => [r.number, r.name]))
  const memorization_pages = totalPages(months)
  const quran_history = toMonthHistory(months, n => surahNames.get(n) ?? '')
  const juz_done = juzReached(months, data.quran_parts, toProgramJuz(juzRows ?? []))

  // الهدف الشهري لمؤشّر التقدّم الزمني (إعدادات المدير)
  const { data: settings } = await admin.from('app_settings').select('target_memorization_pages').eq('id', 1).single()
  const target_per_month = settings?.target_memorization_pages ?? 30

  const { id: _id, ...safe } = data
  return { ...safe, exam_cycles: (cycles ?? []).map(toExamCycle), results, memorization_pages, target_per_month, quran_history, juz_done }
})
