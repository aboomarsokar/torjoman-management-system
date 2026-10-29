import { describe, expect, it } from 'vitest'
import { OFFLINE_DASHBOARD, offlineStartFor } from './offline'
import { EXAMINER_OFFLINE_PATHS, OFFLINE_PATHS, SUPERVISOR_OFFLINE_PATHS, offlinePathsFor, offlineRedirect, orderByKeys, TEACHER_NAV_ORDER } from './navigation'

describe('orderByKeys', () => {
  it('يرتّب بالمفاتيح وما لم يُذكر بعدها بترتيبه', () => {
    const items = [{ key: 'b' }, { key: 'x' }, { key: 'a' }, { key: 'y' }]
    expect(orderByKeys(items, ['a', 'b']).map(i => i.key)).toEqual(['a', 'b', 'x', 'y'])
  })

  it('الحضورُ ثاني بنود المعلّم بعد اللوحة', () => {
    expect(TEACHER_NAV_ORDER.slice(0, 2)).toEqual(['dashboard-teacher', 'attendance-offline'])
  })
})

describe('offlinePathsFor', () => {
  it('للمعلّم (ولمن لا دورَ محفوظاً) هي OFFLINE_PATHS نفسها', () => {
    expect(offlinePathsFor('teacher')).toBe(OFFLINE_PATHS)
    expect(offlinePathsFor(null)).toBe(OFFLINE_PATHS)
  })
  it('المختبِر يعمل على /exams والمعلّم لا', () => {
    expect(offlinePathsFor('examiner')).toContain('/exams')
    expect(offlinePathsFor('teacher')).not.toContain('/exams')
  })
  it('المشرف لا يعمل على /t/home', () => {
    expect(offlinePathsFor('field_supervisor')).not.toContain('/t/home')
    expect(offlinePathsFor('field_supervisor')).toBe(SUPERVISOR_OFFLINE_PATHS)
    expect(offlinePathsFor('examiner')).toBe(EXAMINER_OFFLINE_PATHS)
  })
})

describe('offlineRedirect', () => {
  it('يحفظ تحويلات المعلّم', () => {
    expect(offlineRedirect('/reports', 'teacher')).toBe('/t/quran')
    expect(offlineRedirect('/attendance', 'teacher')).toBe('/t')
    expect(offlineRedirect('/students/x', 'teacher')).toBe('/t/students')
    expect(offlineRedirect('/dashboard', 'teacher')).toBe('/t/home')
    expect(offlineRedirect('/visits', 'teacher')).toBeNull()
  })
  it('/exams ليست للمعلّم فتُحوَّل إلى لوحته', () => {
    expect(offlineRedirect('/exams', 'teacher')).toBe('/t/home')
  })
  it('بلا دورٍ محفوظ كالمعلّم', () => {
    expect(offlineRedirect('/dashboard', null)).toBe('/t/home')
  })
  it('للمشرف والمختبِر إلى شاشتيهما', () => {
    expect(offlineRedirect('/dashboard', 'field_supervisor')).toBe('/visits')
    expect(offlineRedirect('/t/home', 'examiner')).toBe('/exams')
    expect(offlineRedirect('/exams', 'examiner')).toBeNull()
    expect(offlineRedirect('/visits', 'field_supervisor')).toBeNull()
  })
})

describe('offlineStartFor', () => {
  it('شاشةُ الإقلاع بحسب الدور، وللمعلّم ولمن لا دورَ له اللوحة', () => {
    expect(offlineStartFor('field_supervisor')).toBe('/visits')
    expect(offlineStartFor('examiner')).toBe('/exams')
    expect(offlineStartFor('teacher')).toBe(OFFLINE_DASHBOARD)
    expect(offlineStartFor(null)).toBe(OFFLINE_DASHBOARD)
  })
})
