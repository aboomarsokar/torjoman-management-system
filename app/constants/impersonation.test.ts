/**
 * ثوابتُ النيابة تطابق القاعدة: نصُّ المنع = ما ترميه private.assert_session_writable في أحدث هجرةٍ تعرّفها،
 * والقائمةُ البيضاء لا تبلغ المديرَ الإداريّ ولا الطالبَ أبداً.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Role } from './roles'
import {
  IMPERSONATION_READ_ONLY_MESSAGE,
  IMPERSONATION_TARGETS,
  IMPERSONATOR_ROLES,
  mayImpersonateRole
} from './impersonation'

const DIR = 'supabase/migrations'
const DEFINITION = /create or replace function private\.assert_session_writable\(\)[\s\S]*?raise exception '([^']*)'/

const ALL_ROLES: Role[] = [
  'project_supervisor', 'admin_manager', 'technical_manager', 'women_admin',
  'field_supervisor', 'examiner', 'teacher', 'student'
]

describe('ثوابت النيابة', () => {
  it('نصُّ المنع يطابق حارسَ القاعدة في أحدث تعريفٍ له', () => {
    const latest = readdirSync(DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .map(f => readFileSync(`${DIR}/${f}`, 'utf8').match(DEFINITION)?.[1])
      .filter((m): m is string => m !== undefined)
      .at(-1)
    expect(latest, 'لا هجرةَ تعرّف private.assert_session_writable').toBeDefined()
    expect(latest).toBe(IMPERSONATION_READ_ONLY_MESSAGE)
  })

  it('لا فاعلَ ينوب عن المدير الإداري ولا عن طالب', () => {
    for (const actor of IMPERSONATOR_ROLES) {
      expect(IMPERSONATION_TARGETS[actor]).not.toContain('admin_manager')
      expect(IMPERSONATION_TARGETS[actor]).not.toContain('student')
    }
  })

  it('المدير الفني ينوب عن الميدان وحده: المشرف والمختبِر والمعلم (قرار 2026-10-22)', () => {
    expect([...IMPERSONATION_TARGETS.technical_manager].sort()).toEqual(['examiner', 'field_supervisor', 'teacher'])
    for (const r of ['project_supervisor', 'admin_manager', 'technical_manager', 'women_admin'] as const) {
      expect(mayImpersonateRole('technical_manager', r), r).toBe(false)
    }
  })

  it('mayImpersonateRole تطابق القائمة البيضاء لكلّ زوج', () => {
    for (const actor of ALL_ROLES) {
      for (const target of ALL_ROLES) {
        const expected = (IMPERSONATOR_ROLES as readonly Role[]).includes(actor)
          && IMPERSONATION_TARGETS[actor as typeof IMPERSONATOR_ROLES[number]].includes(target)
        expect(mayImpersonateRole(actor, target), `${actor} → ${target}`).toBe(expected)
      }
    }
    expect(mayImpersonateRole(null, 'teacher')).toBe(false)
    expect(mayImpersonateRole(undefined, 'teacher')).toBe(false)
  })
})
