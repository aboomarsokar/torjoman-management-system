/** من يعتمد رصد الشهر عبر الأدوار الثمانية: الفنيّ لا يعتمد. */
import { describe, expect, it } from 'vitest'
import { canApproveReportsRole } from './usePermissions'

describe('canApproveReportsRole', () => {
  const expected: Record<string, boolean> = {
    project_supervisor: false,
    admin_manager: false,
    technical_manager: false,
    women_admin: false,
    field_supervisor: true,
    examiner: false,
    teacher: false,
    student: false
  }
  for (const [role, ok] of Object.entries(expected)) {
    it(`${role} ← ${ok}`, () => {
      expect(canApproveReportsRole(role)).toBe(ok)
    })
  }
  it('بلا دور ← لا', () => {
    expect(canApproveReportsRole(null)).toBe(false)
    expect(canApproveReportsRole(undefined)).toBe(false)
  })
})
