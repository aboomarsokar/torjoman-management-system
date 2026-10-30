/** من يعتمد رصد الشهر عبر الأدوار الثمانية: الفنيّ لا يعتمد. */
import { describe, expect, it } from 'vitest'
import { canApproveReportsRole, canReviewOffDayRole } from './usePermissions'

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

describe('canReviewOffDayRole — اعتمادُ بلاغ «لم تنعقد»', () => {
  const cases: [string | null | undefined, string | null, boolean][] = [
    ['technical_manager', 'female', false],
    ['technical_manager', 'male', true],
    ['technical_manager', null, false],
    ['women_admin', 'female', true],
    ['women_admin', 'male', false],
    ['women_admin', null, false],
    ['admin_manager', 'male', true],
    ['admin_manager', 'female', true],
    ['field_supervisor', null, true],
    ['field_supervisor', 'female', true],
    ['project_supervisor', 'male', false],
    ['examiner', 'male', false],
    ['teacher', 'male', false],
    ['student', 'male', false],
    [null, 'male', false],
    [undefined, 'female', false]
  ]
  for (const [role, gender, ok] of cases) {
    it(`${role} / ${gender} ← ${ok}`, () => {
      expect(canReviewOffDayRole(role, gender)).toBe(ok)
    })
  }
})
