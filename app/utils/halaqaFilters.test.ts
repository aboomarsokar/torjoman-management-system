import { describe, expect, it } from 'vitest'
import {
  applyHalaqaFilters, filtersFromQuery, genderOptions, hasBothGenders, NO_SUPERVISOR, queryFromFilters, supervisorOptions,
  withoutTestHalaqa, type FilterableRow, type SupervisorRef
} from './halaqaFilters'

const rows: FilterableRow[] = [
  { halaqa_id: 'a', halaqa_name: 'آية رضوان — النفق', gender: 'female', teacher_name: 'آية أحمد' },
  { halaqa_id: 'b', halaqa_name: 'براء الشامي — الصبرة', gender: 'male', teacher_name: 'براء ماهر' },
  { halaqa_id: 'c', halaqa_name: 'علي شبانة — تل الهوا', gender: 'male', teacher_name: 'علي جميل' },
  { halaqa_id: 't', halaqa_name: 'حلقة تجريبية', gender: 'male', teacher_name: 'معلم تجريبي' }
]
const sups = new Map<string, SupervisorRef>([
  ['a', { id: 's1', name: 'مها' }],
  ['b', { id: 's2', name: 'راغد' }]
])
const base = { gender: 'all' as const, supervisor: 'all', query: '' }
const ids = (r: FilterableRow[]) => r.map(x => x.halaqa_id)

describe('فلاتر قوائم الحلقات', () => {
  it('الحلقةُ التجريبية خارج المتابعة', () => {
    expect(ids(withoutTestHalaqa(rows))).toEqual(['a', 'b', 'c'])
  })

  it('الجنس', () => {
    expect(ids(applyHalaqaFilters(rows, { ...base, gender: 'female' }, sups))).toEqual(['a'])
    expect(ids(applyHalaqaFilters(rows, { ...base, gender: 'male' }, sups))).toEqual(['b', 'c', 't'])
  })

  it('المشرفُ و«بلا مشرف»', () => {
    expect(ids(applyHalaqaFilters(rows, { ...base, supervisor: 's2' }, sups))).toEqual(['b'])
    expect(ids(applyHalaqaFilters(rows, { ...base, supervisor: NO_SUPERVISOR }, sups))).toEqual(['c', 't'])
  })

  it('البحثُ متسامحٌ بالهمزة والتاء في الحلقة والمعلم، ويجتمع مع غيره', () => {
    expect(ids(applyHalaqaFilters(rows, { ...base, query: 'ايه' }, sups))).toEqual(['a'])
    expect(ids(applyHalaqaFilters(rows, { ...base, query: 'جميل' }, sups))).toEqual(['c'])
    expect(ids(applyHalaqaFilters(rows, { gender: 'male', supervisor: NO_SUPERVISOR, query: 'تل' }, sups))).toEqual(['c'])
  })

  it('خياراتُ المشرف بعدد حلقاته مرتّبةً، و«بلا مشرف» آخراً', () => {
    expect(supervisorOptions(withoutTestHalaqa(rows), sups)).toEqual([
      { value: 's2', label: 'راغد (1)' },
      { value: 's1', label: 'مها (1)' },
      { value: NO_SUPERVISOR, label: 'بلا مشرف (1)' }
    ])
  })

  it('خياراتُ الجنس بعدد كلّ قسم', () => {
    expect(genderOptions(rows).map(o => o.label)).toEqual(['البنين والبنات', 'البنين (3)', 'البنات (1)'])
  })

  it('فلترُ الجنس متى اجتمع القسمان', () => {
    expect(hasBothGenders(rows)).toBe(true)
    expect(hasBothGenders(rows.filter(r => r.gender === 'male'))).toBe(false)
  })

  it('الرابط: قراءةٌ وكتابةٌ والافتراضيُّ يُحذف', () => {
    expect(filtersFromQuery({})).toEqual(base)
    expect(filtersFromQuery({ g: 'x', sup: ['s1'], q: 'علي' })).toEqual({ gender: 'all', supervisor: 's1', query: 'علي' })
    expect(queryFromFilters(base)).toEqual({ g: undefined, sup: undefined, q: undefined })
    expect(queryFromFilters({ gender: 'female', supervisor: NO_SUPERVISOR, query: ' x ' })).toEqual({ g: 'female', sup: 'none', q: 'x' })
  })
})
