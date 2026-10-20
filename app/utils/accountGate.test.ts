import { describe, expect, it } from 'vitest'
import { accountGateDecision } from './accountGate'
import { CHANGE_PASSWORD_PATH } from '~/constants/auth'

const active = { must_change_password: false, status: 'active' }
const mustChange = { must_change_password: true, status: 'active' }

describe('accountGateDecision', () => {
  it('الحساب النشط بلا علَم يمرّ إلى كل شيء', () => {
    expect(accountGateDecision(active, '/dashboard', false)).toBe('allow')
    expect(accountGateDecision(active, CHANGE_PASSWORD_PATH, false)).toBe('allow')
  })

  it('العلَم القائم يحوّل كل مسارٍ محميّ إلى شاشة التغيير', () => {
    expect(accountGateDecision(mustChange, '/dashboard', false)).toBe('change-password')
    expect(accountGateDecision(mustChange, '/me', false)).toBe('change-password')
    expect(accountGateDecision(mustChange, '/students/abc', false)).toBe('change-password')
  })

  it('لا حلقة: شاشة التغيير نفسها والصفحات العامّة تمرّ', () => {
    expect(accountGateDecision(mustChange, CHANGE_PASSWORD_PATH, false)).toBe('allow')
    expect(accountGateDecision(mustChange, '/', true)).toBe('allow')
  })

  it('غير النشط يُخرَج، والعلَم لا يغيّر ذلك', () => {
    expect(accountGateDecision({ must_change_password: false, status: 'disabled' }, '/me', false)).toBe('sign-out')
    expect(accountGateDecision({ must_change_password: true, status: 'pending' }, CHANGE_PASSWORD_PATH, false)).toBe('sign-out')
  })

  it('في النيابة لا يُساق المديرُ إلى تغيير كلمةِ غيره، والسلوكُ بلا الخيار كما هو', () => {
    expect(accountGateDecision(mustChange, '/dashboard', false, { impersonating: true })).toBe('allow')
    expect(accountGateDecision(mustChange, '/dashboard', false, { impersonating: false })).toBe('change-password')
    expect(accountGateDecision({ must_change_password: true, status: 'disabled' }, '/me', false, { impersonating: true })).toBe('sign-out')
  })

  it('تعذّر قراءة الملف ← مرور (الحكم لـRLS)', () => {
    expect(accountGateDecision(null, '/dashboard', false)).toBe('allow')
  })
})
