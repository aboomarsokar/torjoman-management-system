/**
 * جدولُ سلوك النطاق كلُّه: من ينوب عمّن، والعودة، والمدخلات، ومعرّفُ الجلسة من الرمز.
 */
import { describe, expect, it } from 'vitest'
import {
  assertMayImpersonate,
  impersonationReturnTo,
  parseEndInput,
  parseImpersonateInput,
  parseWriteModeInput,
  sessionIdFromAccessToken
} from './impersonationScope'
import type { Role } from '~/constants/roles'

const actor = (role: Role, over: Partial<{ id: string, isImpersonating: boolean }> = {}) => ({ id: 'a', role, isImpersonating: false, ...over })
const target = (role: Role, over: Partial<{ id: string, status: string }> = {}) => ({ id: 't', role, status: 'active', ...over })
const ok = (d: ReturnType<typeof assertMayImpersonate>) => d.ok

describe('assertMayImpersonate', () => {
  it('المدير الإداري عن كلّ موظفٍ نشط ومنهم المدير الفني', () => {
    for (const r of ['project_supervisor', 'technical_manager', 'women_admin', 'field_supervisor', 'examiner', 'teacher'] as Role[]) {
      expect(ok(assertMayImpersonate(actor('admin_manager'), target(r))), r).toBe(true)
    }
  })
  it('المدير الفني عن الميدان وحده، لا عن الإدارة (قرار 2026-10-22)', () => {
    expect(ok(assertMayImpersonate(actor('technical_manager'), target('teacher')))).toBe(true)
    expect(ok(assertMayImpersonate(actor('technical_manager'), target('field_supervisor')))).toBe(true)
    for (const r of ['project_supervisor', 'admin_manager', 'women_admin'] as const) {
      expect(assertMayImpersonate(actor('technical_manager'), target(r)), r).toMatchObject({ ok: false, statusCode: 403 })
    }
  })
  it('لا أحد عن المدير الإداري ولا عن طالب', () => {
    expect(assertMayImpersonate(actor('admin_manager'), target('admin_manager'))).toMatchObject({ ok: false, statusCode: 403 })
    expect(assertMayImpersonate(actor('admin_manager'), target('student'))).toMatchObject({ ok: false, statusCode: 403 })
  })
  it('ولا عن النفس، ولا عن غير النشط', () => {
    expect(assertMayImpersonate(actor('admin_manager', { id: 't' }), target('teacher'))).toMatchObject({ ok: false, statusCode: 400 })
    expect(assertMayImpersonate(actor('admin_manager'), target('teacher', { status: 'disabled' }))).toMatchObject({ ok: false, statusCode: 400 })
  })
  it('⚠️ لا نيابة داخل نيابة — ولو كانت الجلسةُ «مديراً فنياً» (ثغرة الصحابة)', () => {
    expect(assertMayImpersonate(actor('technical_manager', { isImpersonating: true }), target('teacher')))
      .toMatchObject({ ok: false, statusCode: 403 })
  })
  it('ما لم يُسمَّ يُردّ: كلُّ دورٍ غير الفاعلَين', () => {
    for (const r of ['project_supervisor', 'women_admin', 'field_supervisor', 'examiner', 'teacher', 'student'] as Role[]) {
      expect(ok(assertMayImpersonate(actor(r), target('teacher'))), r).toBe(false)
    }
  })
})

describe('impersonationReturnTo', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  it('من القائمة أو من ملفٍّ أو مشرفٍ يعود حيث بدأ', () => {
    expect(impersonationReturnTo('/users', id)).toBe('/users')
    expect(impersonationReturnTo(`/profile/${id}`, id)).toBe(`/profile/${id}`)
    expect(impersonationReturnTo(`/supervisors/${id}`, id)).toBe(`/supervisors/${id}`)
  })
  it('وكلُّ ما سواه ← ملفُّ الهدف (لا رابطَ حرٌّ يقود خارج النظام)', () => {
    for (const bad of ['https://x.y', '//evil', '/users?x=1', '/students', 42, null]) {
      expect(impersonationReturnTo(bad, id)).toBe(`/profile/${id}`)
    }
  })
})

describe('parseImpersonateInput / sessionIdFromAccessToken', () => {
  it('المعرّفُ uuid وحده — ولا بريدَ يُقبل من الطلب', () => {
    expect(parseImpersonateInput({ profileId: 'x' }).ok).toBe(false)
    const p = parseImpersonateInput({ profileId: '11111111-1111-4111-8111-111111111111', email: 'a@b.c' })
    expect(p.ok && p.value).toEqual({ profileId: '11111111-1111-4111-8111-111111111111', from: null })
  })
  it('يقرأ session_id من الرمز، ورمزٌ بلا مطالبةٍ ← null', () => {
    const tok = (o: object) => `h.${Buffer.from(JSON.stringify(o)).toString('base64url')}.s`
    expect(sessionIdFromAccessToken(tok({ session_id: 'abc' }))).toBe('abc')
    expect(sessionIdFromAccessToken(tok({ sub: 'x' }))).toBeNull()
    expect(sessionIdFromAccessToken('garbage')).toBeNull()
  })
})

describe('parseWriteModeInput / parseEndInput', () => {
  it('وضعُ التعديل يشترط on منطقيّاً', () => {
    expect(parseWriteModeInput({ on: true })).toEqual({ ok: true, value: { on: true } })
    expect(parseWriteModeInput({ on: false })).toEqual({ ok: true, value: { on: false } })
    expect(parseWriteModeInput({ on: 'yes' }).ok).toBe(false)
    expect(parseWriteModeInput(null).ok).toBe(false)
  })
  it('الإنهاءُ يعود افتراضاً، وresume غيرُ المنطقيّ يُردّ', () => {
    expect(parseEndInput(undefined)).toEqual({ ok: true, value: { resume: true } })
    expect(parseEndInput({ resume: false })).toEqual({ ok: true, value: { resume: false } })
    expect(parseEndInput({ resume: 'no' }).ok).toBe(false)
  })
})
