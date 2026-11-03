import { describe, expect, it } from 'vitest'
import { OVERVIEW_ALL, attendancePct, filterOverview, type OverviewRow } from './monthlyOverview'

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
