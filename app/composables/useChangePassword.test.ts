/**
 * تغيير كلمة المرور — الفحص قبل الطلب، والترتيب (الكلمة ← العلَم ← الملف)،
 * وفشلُ إنزال العلَم خطأٌ عربيّ ظاهر لا نجاحٌ كاذب (وإلا حُبس المستخدم خلف شاشة التغيير).
 */
import { describe, expect, it, vi } from 'vitest'
import {
  applyPasswordChange, FLAG_CLEAR_FAILED, PASSWORD_MISMATCH, PASSWORD_SAME_AS_CURRENT, PASSWORD_TOO_SHORT, PASSWORD_WEAK,
  passwordChangeError, type PasswordChangeSteps
} from './useChangePassword'

function steps(over: Partial<PasswordChangeSteps> = {}) {
  const order: string[] = []
  const s: PasswordChangeSteps = {
    updatePassword: vi.fn(async () => {
      order.push('password')
      return { error: null }
    }),
    clearFlag: vi.fn(async () => {
      order.push('flag')
      return { error: null, rows: 1 }
    }),
    reloadProfile: vi.fn(async () => {
      order.push('reload')
    }),
    ...over
  }
  return { s, order }
}

describe('passwordChangeError', () => {
  it('يرفض القصيرة وغير المتطابقتين ويقبل الصحيحة', () => {
    expect(passwordChangeError('1234567', '1234567')).toBe(PASSWORD_TOO_SHORT)
    expect(passwordChangeError('12345678', '12345679')).toBe(PASSWORD_MISMATCH)
    expect(passwordChangeError('12345678', '12345678')).toBeNull()
  })
})

describe('applyPasswordChange', () => {
  it('الكلمة ثم العلَم ثم إعادة قراءة الملف', async () => {
    const { s, order } = steps()
    await applyPasswordChange('newpass123', s)
    expect(order).toEqual(['password', 'flag', 'reload'])
  })

  it('فشل إنزال العلَم (خطأ أو صفر صفوف) يرمي رسالةً عربية ولا يعيد القراءة', async () => {
    const withError = steps({ clearFlag: async () => ({ error: { message: 'denied' }, rows: 0 }) })
    await expect(applyPasswordChange('newpass123', withError.s)).rejects.toThrow(FLAG_CLEAR_FAILED)
    expect(withError.s.reloadProfile).not.toHaveBeenCalled()

    const zeroRows = steps({ clearFlag: async () => ({ error: null, rows: 0 }) })
    await expect(applyPasswordChange('newpass123', zeroRows.s)).rejects.toThrow(FLAG_CLEAR_FAILED)
  })

  it('خطأ Auth يوقف قبل العلَم، والكلمة نفسها برسالةٍ واضحة', async () => {
    const same = steps({ updatePassword: async () => ({ error: { code: 'same_password', message: 'New password should be different' } }) })
    await expect(applyPasswordChange('newpass123', same.s)).rejects.toThrow(PASSWORD_SAME_AS_CURRENT)
    expect(same.s.clearFlag).not.toHaveBeenCalled()

    const weak = steps({ updatePassword: async () => ({ error: { code: 'weak_password', message: 'weak' } }) })
    await expect(applyPasswordChange('newpass123', weak.s)).rejects.toMatchObject({ message: PASSWORD_WEAK })
  })
})
