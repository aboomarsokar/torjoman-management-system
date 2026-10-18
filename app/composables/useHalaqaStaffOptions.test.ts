/**
 * خيارات طاقم الحلقة — لا قائمة قبل الجنس، والطاقم من جنس الحلقة وحدَه، والمعلم على حلقةٍ واحدة،
 * وتغيير الجنس يُسقط المختار من الجنس الآخر (ثغرة 2026-10-18: معلمةٌ لحلقة بنين بمشرفٍ ومختبِرٍ ذكرين).
 */
import { describe, expect, it } from 'vitest'
import {
  availableTeachers, NO_STAFF, reconcileStaff, staffOfGender, suggestedExaminer, type StaffRow
} from './useHalaqaStaffOptions'

const tM: StaffRow = { id: 'tm', full_name: 'معلم', gender: 'male' }
const tM2: StaffRow = { id: 'tm2', full_name: 'معلم ثانٍ', gender: 'male' }
const tF: StaffRow = { id: 'tf', full_name: 'معلمة', gender: 'female' }
const sM: StaffRow = { id: 'sm', full_name: 'مشرف', gender: 'male' }
const sF: StaffRow = { id: 'sf', full_name: 'مشرفة', gender: 'female' }
const eM: StaffRow = { id: 'em', full_name: 'مختبِر', gender: 'male' }
const eF: StaffRow = { id: 'ef', full_name: 'مختبِرة', gender: 'female' }
const lists = { teachers: [tM, tM2, tF], supervisors: [sM, sF], examiners: [eM, eF] }

describe('staffOfGender', () => {
  it('لا أحد قبل اختيار الجنس', () => {
    expect(staffOfGender([tM, tF], '')).toEqual([])
  })
  it('من جنس الحلقة وحدَه', () => {
    expect(staffOfGender([tM, tF], 'female')).toEqual([tF])
  })
})

describe('availableTeachers', () => {
  const halqat = [{ id: 'h1', teacher_id: 'tm', status: 'active' }, { id: 'h2', teacher_id: 'tm2', status: 'stopped' }]
  it('يُخفي معلماً على حلقةٍ نشطة أخرى، ولا يحسب المتوقفة', () => {
    expect(availableTeachers(lists.teachers, halqat, 'male', null, null).map(t => t.id)).toEqual(['tm2'])
  })
  it('يُبقي معلم الحلقة المعدَّلة نفسها', () => {
    expect(availableTeachers(lists.teachers, halqat, 'male', 'h1', 'tm').map(t => t.id)).toEqual(['tm', 'tm2'])
  })
  it('لا يعرض معلمةً لحلقة بنين', () => {
    expect(availableTeachers(lists.teachers, [], 'male', null, null).map(t => t.id)).not.toContain('tf')
  })
})

describe('suggestedExaminer', () => {
  it('الوحيد من الجنس يُقترح، وإلا بلا مختبِر', () => {
    expect(suggestedExaminer([eM, eF], 'female')).toBe('ef')
    expect(suggestedExaminer([eM, { ...eM, id: 'em2' }], 'male')).toBe(NO_STAFF)
    expect(suggestedExaminer([eM, eF], '')).toBe(NO_STAFF)
  })
})

describe('reconcileStaff', () => {
  it('تغيير الجنس إلى بنات يُسقط الطاقم الذكوري ويقترح المختبِرة', () => {
    const sel = { teacher_id: 'tm', supervisor_id: 'sm', examiner_id: 'em' }
    expect(reconcileStaff(sel, 'female', lists)).toEqual({ teacher_id: '', supervisor_id: NO_STAFF, examiner_id: 'ef' })
  })
  it('يُبقي الطاقم المطابق كما هو', () => {
    const sel = { teacher_id: 'tf', supervisor_id: 'sf', examiner_id: NO_STAFF }
    expect(reconcileStaff(sel, 'female', lists)).toEqual({ teacher_id: 'tf', supervisor_id: 'sf', examiner_id: 'ef' })
  })
  it('القوائم الفارغة (لم تصل بعد) لا تُفرّغ اختياراً قائماً', () => {
    const sel = { teacher_id: 'tm', supervisor_id: 'sm', examiner_id: 'em' }
    expect(reconcileStaff(sel, 'male', { teachers: [], supervisors: [], examiners: [] })).toEqual(sel)
  })
})
