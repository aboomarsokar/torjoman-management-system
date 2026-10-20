/**
 * تبديلُ الجلسة في النيابة: refreshSession أوّلاً ثم تحميلٌ كامل — ولا تحميلَ إن فشل التبديل
 * (وإلا فُتحت الوجهةُ بجلسةٍ مُبطَلة). والإنهاءُ المرفوض (401/409) نهائيٌّ لا يُعاد.
 */
import { describe, expect, it, vi } from 'vitest'
import { applySessionSwitch, applyStart, endFailureIsTerminal, type SessionSwitchSteps } from './useImpersonation'
import { SESSION_SWITCH_FAILED } from '~/utils/impersonation'

function steps(over: Partial<SessionSwitchSteps> = {}) {
  const order: string[] = []
  const s: SessionSwitchSteps = {
    refreshSession: vi.fn(async (token: string) => {
      order.push(`refresh:${token}`)
      return { error: null }
    }),
    replace: vi.fn((to: string) => {
      order.push(`replace:${to}`)
    }),
    ...over
  }
  return { s, order }
}

describe('applyStart', () => {
  it('refreshSession برمز النيابة ثم replace إلى صفحة الهدف، بالترتيب', async () => {
    const { s, order } = steps()
    await applyStart({ refreshToken: 'rt-target', targetHome: '/dashboard' }, s)
    expect(order).toEqual(['refresh:rt-target', 'replace:/dashboard'])
  })

  it('فشلُ التبديل يرمي رسالةً عربية ولا يُحمّل الوجهة', async () => {
    const { s } = steps({ refreshSession: async () => ({ error: { message: 'Invalid Refresh Token' } }) })
    await expect(applyStart({ refreshToken: 'x', targetHome: '/dashboard' }, s)).rejects.toThrow(SESSION_SWITCH_FAILED)
    expect(s.replace).not.toHaveBeenCalled()
  })

  it('رمزٌ فارغ لا يُرسل أصلاً', async () => {
    const { s } = steps()
    await expect(applySessionSwitch('', '/users', s)).rejects.toThrow(SESSION_SWITCH_FAILED)
    expect(s.refreshSession).not.toHaveBeenCalled()
    expect(s.replace).not.toHaveBeenCalled()
  })
})

describe('endFailureIsTerminal', () => {
  it('401 و409 نهائيّان، وغيرُهما يُعاد', () => {
    expect(endFailureIsTerminal({ statusCode: 401 })).toBe(true)
    expect(endFailureIsTerminal({ response: { status: 409 } })).toBe(true)
    expect(endFailureIsTerminal({ statusCode: 500 })).toBe(false)
    expect(endFailureIsTerminal(new Error('network'))).toBe(false)
  })
})
