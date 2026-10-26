import { describe, expect, it } from 'vitest'
import { draftChanged, keptAbsences } from './useOfflineAttendance'

describe('keptAbsences', () => {
  it('يحذف من تخطّاهم الرفع', () => {
    expect(keptAbsences({ a: 'excused', b: 'unexcused' }, ['b'])).toEqual({ a: 'excused' })
  })
})

describe('draftChanged', () => {
  it('يرى تغيّرَ الحالة لطلاب القائمة وحدهم', () => {
    expect(draftChanged({ a: 'excused' }, { a: 'excused' }, ['a'])).toBe(false)
    expect(draftChanged({ a: 'excused' }, {}, ['a'])).toBe(true)
    expect(draftChanged({}, { gone: 'excused' }, ['a'])).toBe(false)
  })
})
