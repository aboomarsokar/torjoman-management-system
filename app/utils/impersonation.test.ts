/**
 * أدواتُ شريط النيابة النقيّة: الساعةُ بتوقيت غزة، والعدُّ التنازليّ، ونافذةُ الكتابة، والانتهاء،
 * ونصُّ التأكيد حرفاً كالمواصفة، وقرارُ رسالة الرفض في وضع القراءة.
 */
import { describe, expect, it } from 'vitest'
import { IMPERSONATION_READ_ONLY_MESSAGE } from '~/constants/impersonation'
import {
  clockLabel, countdownLabel, expired, IMPERSONATION_BLOCKED_MESSAGE, impersonateConfirmText,
  isSessionSwitching, markSessionSwitching, minutesLeftLabel, readOnlyRefusal, sessionReadOnly, shouldReloadOnIdentityChange, writeOpen
} from './impersonation'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const status = (over: Partial<{ writeUntil: string | null, expiresAt: string, ended: boolean }> = {}) => ({
  writeUntil: null, expiresAt: iso(30 * 60_000), ended: false, ...over
})

describe('clockLabel', () => {
  it('HH:MM بأرقامٍ لاتينية وبتوقيت غزة (+3 في 10-2026)', () => {
    expect(clockLabel('2026-10-20T12:05:00Z')).toBe('15:05')
    expect(clockLabel('2026-10-20T21:30:00Z')).toBe('00:30')
  })
})

describe('countdownLabel', () => {
  it('mm:ss ولا يقلّ عن 00:00', () => {
    expect(countdownLabel(iso((9 * 60 + 5) * 1000), NOW)).toBe('09:05')
    expect(countdownLabel(iso(0), NOW)).toBe('00:00')
    expect(countdownLabel(iso(-5000), NOW)).toBe('00:00')
    expect(countdownLabel(iso(10 * 60_000), NOW)).toBe('10:00')
  })
})

describe('minutesLeftLabel', () => {
  it('دقائقُ بالتقريب إلى أعلى ولا تقلّ عن صفر', () => {
    expect(minutesLeftLabel(iso((9 * 60 + 5) * 1000), NOW)).toBe('تبقّى 10 د')
    expect(minutesLeftLabel(iso(60_000), NOW)).toBe('تبقّى 1 د')
    expect(minutesLeftLabel(iso(-5000), NOW)).toBe('تبقّى 0 د')
  })
})

describe('shouldReloadOnIdentityChange', () => {
  it('تبدّلُ حسابٍ بحسابٍ في لسانٍ لا يبدّل بنفسه ← إعادةُ تحميل', () => {
    expect(shouldReloadOnIdentityChange('actor', 'target', false)).toBe(true)
  })
  it('لا عند أوّل تحميل ولا الدخول ولا الخروج ولا في اللسان المبدِّل ولا بلا تغيّر', () => {
    expect(shouldReloadOnIdentityChange(undefined, 'actor', false)).toBe(false)
    expect(shouldReloadOnIdentityChange(null, 'actor', false)).toBe(false)
    expect(shouldReloadOnIdentityChange('actor', null, false)).toBe(false)
    expect(shouldReloadOnIdentityChange('actor', 'target', true)).toBe(false)
    expect(shouldReloadOnIdentityChange('actor', 'actor', false)).toBe(false)
  })
})

describe('writeOpen / expired / sessionReadOnly', () => {
  it('نافذةُ الكتابة مفتوحةٌ ما دام write_until في المستقبل', () => {
    expect(writeOpen(null, NOW)).toBe(false)
    expect(writeOpen({ writeUntil: null }, NOW)).toBe(false)
    expect(writeOpen({ writeUntil: iso(-1000) }, NOW)).toBe(false)
    expect(writeOpen({ writeUntil: iso(1000) }, NOW)).toBe(true)
  })
  it('الانتهاءُ عند بلوغ expires_at', () => {
    expect(expired(null, NOW)).toBe(false)
    expect(expired({ expiresAt: iso(1000) }, NOW)).toBe(false)
    expect(expired({ expiresAt: iso(0) }, NOW)).toBe(true)
  })
  it('القراءةُ فقط: نيابةٌ بلا نافذة، أو مختومة ولو بنافذة — وبلا نيابة لا قيد', () => {
    expect(sessionReadOnly(null, NOW)).toBe(false)
    expect(sessionReadOnly(status(), NOW)).toBe(true)
    expect(sessionReadOnly(status({ writeUntil: iso(60_000) }), NOW)).toBe(false)
    expect(sessionReadOnly(status({ writeUntil: iso(60_000), ended: true }), NOW)).toBe(true)
  })
})

describe('impersonateConfirmText', () => {
  it('حرفاً كالمواصفة', () => {
    expect(impersonateConfirmText('أحمد')).toEqual({
      title: 'الدخول بحساب أحمد',
      lines: ['تفتح شاشته كما يراها، قراءةً فقط', 'يصله إشعارٌ بأنّك اطّلعت على حسابه', 'تنتهي بعد نصف ساعة']
    })
  })
})

describe('readOnlyRefusal', () => {
  const rls = { code: '42501', message: 'new row violates row-level security policy' }
  it('رفضُ RLS أو حارسِ القاعدة أو 403 المستودع في نيابة القراءة ← رسالةُ وضع القراءة', () => {
    expect(readOnlyRefusal(rls, status(), NOW)).toBe(IMPERSONATION_BLOCKED_MESSAGE)
    expect(readOnlyRefusal({ code: '42501', message: IMPERSONATION_READ_ONLY_MESSAGE }, status(), NOW)).toBe(IMPERSONATION_BLOCKED_MESSAGE)
    expect(readOnlyRefusal({ __isStorageError: true, name: 'StorageApiError', statusCode: '403', message: 'Unauthorized' }, status(), NOW))
      .toBe(IMPERSONATION_BLOCKED_MESSAGE)
  })
  it('بلا نيابة، أو في وضع التعديل، أو لخطأٍ آخر ← لا شيء', () => {
    expect(readOnlyRefusal(rls, null, NOW)).toBeNull()
    expect(readOnlyRefusal(rls, status({ writeUntil: iso(60_000) }), NOW)).toBeNull()
    expect(readOnlyRefusal(new Error('network down'), status(), NOW)).toBeNull()
  })
  it('منحٌ منسيّ (42501 «permission denied») و403 من غير المستودع لا يُخفيان خلف «وضع القراءة»', () => {
    expect(readOnlyRefusal({ code: '42501', message: 'permission denied for function can_view' }, status(), NOW)).toBeNull()
    expect(readOnlyRefusal({ statusCode: 403, message: 'Forbidden' }, status(), NOW)).toBeNull()
  })
})

describe('علَمُ تبديل الجلسة', () => {
  it('يُرفع ويُنزل', () => {
    expect(isSessionSwitching()).toBe(false)
    markSessionSwitching(true)
    expect(isSessionSwitching()).toBe(true)
    markSessionSwitching(false)
    expect(isSessionSwitching()).toBe(false)
  })
})
