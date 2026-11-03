import { describe, expect, it } from 'vitest'
import { OVERVIEW_ALL, attendancePct, filterOverview, overviewSummary, sortOverview, type OverviewRow } from './monthlyOverview'

describe('attendancePct', () => {
  it('1 − الغيابات ÷ (الأيام × الطلاب)', () => {
    expect(attendancePct(20, 10, 30)).toBe(85)
    expect(attendancePct(20, 10, 0)).toBe(100)
  })
  it('بلا أيامٍ أو طلاب ← null', () => {
    expect(attendancePct(0, 10, 0)).toBeNull()
    expect(attendancePct(20, 0, 0)).toBeNull()
  })
})

describe('filterOverview', () => {
  const r = (id: string, teacher: string, gender: string, status: string | null) => ({ halaqa_id: id, halaqa_name: `${teacher} — الرمال`, teacher_name: teacher, gender, report_status: status }) as unknown as OverviewRow
  const rows = [r('a', 'آية رضوان', 'female', 'draft'), r('b', 'أحمد حمدان', 'male', 'submitted'), r('c', 'أنور الزبدة', 'male', null)]
  const all = { query: '', status: OVERVIEW_ALL, gender: OVERVIEW_ALL }
  it('بالمعلم (متسامحٌ مع الهمزة) وبالحالة (لم يبدأ = none) وبالجنس', () => {
    expect(filterOverview(rows, { ...all, query: 'ايه' }).map(x => x.halaqa_id)).toEqual(['a'])
    expect(filterOverview(rows, { ...all, status: 'none' }).map(x => x.halaqa_id)).toEqual(['c'])
    expect(filterOverview(rows, { ...all, gender: 'male', status: 'submitted' }).map(x => x.halaqa_id)).toEqual(['b'])
    expect(filterOverview(rows, all)).toHaveLength(3)
  })
})

describe('sortOverview وoverviewSummary', () => {
  const r = (name: string, att: number | null, teacher: number | null, status: string | null, students = 10) =>
    ({ halaqa_id: name, halaqa_name: name, students, attendancePct: att, teacherPct: teacher, report_status: status, visits: undefined }) as unknown as OverviewRow
  const rows = [r('ب', 90, 50, 'approved'), r('أ', null, 80, 'submitted', 5), r('ج', 70, null, null)]
  it('يرتّب بالعمود، وما لا قيمةَ له في الآخر في الاتجاهين', () => {
    expect(sortOverview(rows, 'attendance', 'desc').map(x => x.halaqa_id)).toEqual(['ب', 'ج', 'أ'])
    expect(sortOverview(rows, 'attendance', 'asc').map(x => x.halaqa_id)).toEqual(['ج', 'ب', 'أ'])
    expect(sortOverview(rows, 'name', 'asc').map(x => x.halaqa_id)).toEqual(['أ', 'ب', 'ج'])
  })
  it('الخلاصة: المتوسّطُ لما له قيمة، والمعلّقُ = مسودة + لم يبدأ', () => {
    expect(overviewSummary(rows)).toEqual({ halqat: 3, students: 25, attendance: 80, teacher: 65, approved: 1, submitted: 1, pending: 1 })
  })
})
