import { describe, expect, it } from 'vitest'
import { MANAGER_ROLES, STAFF_ROLES, roleLabel } from './roles'

describe('roleLabel', () => {
  it('يؤنّث حسب الجنس', () => {
    expect(roleLabel('admin_manager', 'male')).toBe('المدير الإداري')
    expect(roleLabel('admin_manager', 'female')).toBe('المديرة الإدارية')
    expect(roleLabel('field_supervisor', 'female')).toBe('مشرفة ميدانية')
    expect(roleLabel('examiner', 'female')).toBe('مختبِرة')
  })
  it('بلا جنس = المذكّر', () => {
    expect(roleLabel('teacher', null)).toBe('معلم')
  })
  it('المديرة الإدارية (قسم البنات) مسمّى واحد لأيّ جنس', () => {
    expect(roleLabel('women_admin', 'female')).toBe('المديرة الإدارية')
    expect(roleLabel('women_admin', 'male')).toBe('المديرة الإدارية')
    expect(roleLabel('women_admin', null)).toBe('المديرة الإدارية')
  })
  it('مشرف المشروع يؤنّث حسب الجنس', () => {
    expect(roleLabel('project_supervisor', 'male')).toBe('مشرف المشروع')
    expect(roleLabel('project_supervisor', 'female')).toBe('مشرفة المشروع')
  })
})

describe('مجموعات الأدوار', () => {
  it('المديران: الإداري والفنّي فقط', () => {
    expect(MANAGER_ROLES).toEqual(['admin_manager', 'technical_manager'])
  })
  it('الطاقم = كلّ الأدوار عدا الطالب، ويشمل المديرة الإدارية', () => {
    expect(STAFF_ROLES).toContain('women_admin')
    expect(STAFF_ROLES).not.toContain('student')
    expect(STAFF_ROLES).toHaveLength(7)
  })
})
