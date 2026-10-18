import { describe, expect, it } from 'vitest'
import { loginErrorMessage } from './loginError'
import { LOGIN_RATE_LIMITED, LOGIN_REJECTION } from '~/constants/auth'

describe('loginErrorMessage', () => {
  it('تجاوز الحدّ (429 أو الرمز) برسالة الانتظار', () => {
    expect(loginErrorMessage({ status: 429 })).toBe(LOGIN_RATE_LIMITED)
    expect(loginErrorMessage({ code: 'over_request_rate_limit', status: 400 })).toBe(LOGIN_RATE_LIMITED)
    expect(LOGIN_RATE_LIMITED).toBe('محاولات كثيرة، انتظر دقيقة ثم حاول.')
  })
  it('كل رفضٍ آخر برسالةٍ واحدة لا تفرّق الرقم عن الكلمة', () => {
    expect(loginErrorMessage({ status: 400, code: 'invalid_credentials' })).toBe(LOGIN_REJECTION)
    expect(loginErrorMessage(null)).toBe(LOGIN_REJECTION)
    expect(LOGIN_REJECTION).toBe('الرقم أو كلمة المرور غير صحيحة.')
  })
})
