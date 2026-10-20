import { describe, expect, it } from 'vitest'
import { queryFromTab, tabFromQuery } from './useStudentTab'

describe('تبويب صفحة الطالب في الرابط', () => {
  it('المعروفُ يُقرأ كما هو', () => {
    expect(tabFromQuery('journey')).toBe('journey')
    expect(tabFromQuery('data')).toBe('data')
  })

  it('الغائبُ والمجهولُ والمكرّرُ ← لوحة التحكم', () => {
    expect(tabFromQuery(undefined)).toBe('dashboard')
    expect(tabFromQuery('x')).toBe('dashboard')
    expect(tabFromQuery(['journey'])).toBe('dashboard')
  })

  it('الأولُ لا يُكتب في الرابط', () => {
    expect(queryFromTab('dashboard')).toBeUndefined()
    expect(queryFromTab('data')).toBe('data')
  })
})
