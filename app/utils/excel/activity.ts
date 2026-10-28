/**
 * أوراقُ النشاط للتصدير (طلب المستخدم 2026-10-28): الحضورُ الشهريّ (طالبٌ × يوم)، والإنجازُ القرآنيّ للشهر،
 * ونتائجُ الاختبارات. منطقٌ صرفٌ مختبَر؛ الجلبُ في useDataExport.
 */
import type { Database } from '~/types/database.types'
import { ATTENDANCE_MARKS, REPORT_STATUS_LABELS } from '~/constants/dataExport'
import { cycleLabel, type ExamCycle } from '~/utils/exams/cycles'
import { dmy, type HalaqaRow, type StudentRow } from './people'
import type { Cell, SheetSpec } from './workbook'

type Tables = Database['public']['Tables']
type DayRow = Pick<Tables['attendance_days']['Row'], 'halaqa_id' | 'day'>
type AbsenceRow = Pick<Tables['attendance_absences']['Row'], 'halaqa_id' | 'day' | 'student_id' | 'kind'>
type ReportRow = Pick<Tables['monthly_reports']['Row'], 'id' | 'halaqa_id' | 'status'>
type RecordRow = Pick<Tables['quran_records']['Row'], 'report_id' | 'student_id' | 'from_surah' | 'from_ayah' | 'to_surah' | 'to_ayah' | 'pages_memorized' | 'pages_reviewed' | 'notes'>
export type ExamResultRow = Pick<Tables['exam_results']['Row'], 'student_id' | 'examiner_id' | 'exam_date' | 'tajweed_score' | 'total_score' | 'pass_mark_snapshot' | 'passed' | 'notes'>
  & { item: { exam_cycle_id: number | null, list: { halaqa_id: string } | null } | null }

const byHalaqaThenName = (h: Map<string, HalaqaRow>) => (a: StudentRow, b: StudentRow) =>
  (h.get(a.halaqa_id ?? '')?.name ?? '').localeCompare(h.get(b.halaqa_id ?? '')?.name ?? '', 'ar') || a.full_name.localeCompare(b.full_name, 'ar')

/** الحضورُ الشهريّ: صفٌّ لكلّ طالب، وعمودٌ لكلّ يومٍ فُتح في أيّ حلقة، ثم المجاميع. */
export function attendanceSheet(label: string, halaqat: HalaqaRow[], students: StudentRow[], days: DayRow[], absences: AbsenceRow[]): SheetSpec {
  const halaqaById = new Map(halaqat.map(h => [h.id, h]))
  const dates = [...new Set(days.map(d => d.day))].sort()
  const opened = new Set(days.map(d => `${d.halaqa_id}|${d.day}`))
  const absent = new Map(absences.map(a => [`${a.student_id}|${a.day}`, a.kind]))
  const absentees = new Set(absences.map(a => a.student_id))
  const list = students.filter(s => s.halaqa_id && (s.status === 'active' || absentees.has(s.id))).sort(byHalaqaThenName(halaqaById))
  const rows = list.map((s) => {
    const row: Record<string, Cell> = { halaqa: halaqaById.get(s.halaqa_id!)?.name ?? '', name: s.full_name }
    let open = 0, unexcused = 0, excused = 0
    for (const d of dates) {
      if (!opened.has(`${s.halaqa_id}|${d}`)) {
        row[d] = ATTENDANCE_MARKS.closed
        continue
      }
      open++
      const kind = absent.get(`${s.id}|${d}`)
      if (kind === 'unexcused') unexcused++
      if (kind === 'excused') excused++
      row[d] = kind === 'unexcused' ? ATTENDANCE_MARKS.unexcused : kind === 'excused' ? ATTENDANCE_MARKS.excused : ATTENDANCE_MARKS.present
    }
    return { ...row, open, present: open - unexcused - excused, unexcused, excused }
  })
  return {
    name: `الحضور ${label}`,
    columns: [
      { header: 'الحلقة', key: 'halaqa', width: 22 }, { header: 'الطالب', key: 'name', width: 28 },
      ...dates.map(d => ({ header: dmy(d).replace(/\/\d{4}$/, ''), key: d, width: 6 })),
      { header: 'أيام الدوام', key: 'open', width: 9 }, { header: 'حضور', key: 'present', width: 7 },
      { header: 'غياب بلا عذر', key: 'unexcused', width: 9 }, { header: 'غياب بعذر', key: 'excused', width: 9 }
    ],
    rows
  }
}

/** الإنجازُ القرآنيّ للشهر: صفٌّ لكلّ سجلّ طالب، بالسور بأسمائها وحالة رصد حلقته. */
export function quranSheet(label: string, halaqat: HalaqaRow[], students: StudentRow[], names: Map<string, string>,
  reports: ReportRow[], records: RecordRow[], surahs: Map<number, string>): SheetSpec {
  const halaqaById = new Map(halaqat.map(h => [h.id, h]))
  const reportById = new Map(reports.map(r => [r.id, r]))
  const studentById = new Map(students.map(s => [s.id, s]))
  const pos = (s: number | null, a: number | null) => (s ? `${surahs.get(s) ?? s}${a ? ` ${a}` : ''}` : '')
  const rows = records.map((r) => {
    const rep = reportById.get(r.report_id)
    const h = rep ? halaqaById.get(rep.halaqa_id) : undefined
    return {
      halaqa: h?.name ?? '', teacher: h?.teacher_id ? names.get(h.teacher_id) ?? '' : '', name: studentById.get(r.student_id)?.full_name ?? '',
      from: pos(r.from_surah, r.from_ayah), to: pos(r.to_surah, r.to_ayah), memorized: r.pages_memorized, reviewed: r.pages_reviewed,
      status: rep ? REPORT_STATUS_LABELS[rep.status] ?? rep.status : '', notes: r.notes
    }
  }).sort((a, b) => a.halaqa.localeCompare(b.halaqa, 'ar') || a.name.localeCompare(b.name, 'ar'))
  return {
    name: `الإنجاز ${label}`,
    columns: [
      { header: 'الحلقة', key: 'halaqa', width: 22 }, { header: 'المعلّم', key: 'teacher', width: 24 },
      { header: 'الطالب', key: 'name', width: 28 }, { header: 'من', key: 'from', width: 16 }, { header: 'إلى', key: 'to', width: 16 },
      { header: 'صفحات الحفظ', key: 'memorized', width: 10 }, { header: 'صفحات المراجعة', key: 'reviewed', width: 11 },
      { header: 'حالة الرصد', key: 'status', width: 10 }, { header: 'ملاحظات', key: 'notes', width: 24 }
    ],
    rows
  }
}

/** نتائجُ الاختبارات: صفٌّ لكلّ نتيجة، بالدورة وحلقة الترشيح والمختبِر. */
export function examsSheet(results: ExamResultRow[], halaqat: HalaqaRow[], students: StudentRow[], names: Map<string, string>, cycles: ExamCycle[]): SheetSpec {
  const halaqaById = new Map(halaqat.map(h => [h.id, h]))
  const studentById = new Map(students.map(s => [s.id, s]))
  const cycleById = new Map(cycles.map(c => [c.id, c]))
  const rows = [...results].sort((a, b) => b.exam_date.localeCompare(a.exam_date)).map((r) => {
    const c = r.item?.exam_cycle_id ? cycleById.get(r.item.exam_cycle_id) : undefined
    return {
      date: dmy(r.exam_date), name: studentById.get(r.student_id)?.full_name ?? '', halaqa: halaqaById.get(r.item?.list?.halaqa_id ?? '')?.name ?? '',
      cycle: c ? `${cycleLabel(c)} — الأجزاء ${c.parts_from}–${c.parts_to}` : '', tajweed: r.tajweed_score, total: r.total_score,
      pass: r.pass_mark_snapshot, result: r.passed ? 'ناجح' : 'لم يجتز', examiner: names.get(r.examiner_id ?? '') ?? '', notes: r.notes
    }
  })
  return {
    name: 'نتائج الاختبارات',
    columns: [
      { header: 'التاريخ', key: 'date', width: 11 }, { header: 'الطالب', key: 'name', width: 28 }, { header: 'الحلقة', key: 'halaqa', width: 22 },
      { header: 'الدورة', key: 'cycle', width: 34 }, { header: 'التجويد', key: 'tajweed', width: 8 }, { header: 'المجموع', key: 'total', width: 8 },
      { header: 'علامة الاجتياز', key: 'pass', width: 10 }, { header: 'النتيجة', key: 'result', width: 9 },
      { header: 'المختبِر', key: 'examiner', width: 24 }, { header: 'ملاحظات', key: 'notes', width: 24 }
    ],
    rows
  }
}
