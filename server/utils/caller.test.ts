/**
 * هل تكتب الجلسة؟ وهل هي حيّة؟ — تطابق private.session_is_read_only: بلا صفّ نيابةٍ تكتب، وبصفٍّ ما دامت
 * النيابةُ قائمةً (لم تُختم ولم تنتهِ) والنافذةُ مفتوحة. والحياةُ جوابُ GoTrue عن الرمز، ويفشل مغلقاً.
 */
import { describe, expect, it, vi } from 'vitest'

// caller.ts يستورد عملاءَ Nuxt — والاختبارُ للدوالّ النقيّة وحدها.
vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn(),
  serverSupabaseSession: vi.fn(),
  serverSupabaseUser: vi.fn()
}))

const { impersonationIsOpen, isLiveSessionResult, sessionCanWrite } = await import('./caller')

const now = Date.parse('2026-10-20T10:00:00Z')

describe('sessionCanWrite', () => {
  it('جلسةٌ ليست نيابة تكتب', () => {
    expect(sessionCanWrite(null)).toBe(true)
  })
  it('نيابةٌ بلا نافذة ← قراءةٌ فقط', () => {
    expect(sessionCanWrite({ write_until: null }, now)).toBe(false)
  })
  it('نافذةٌ في الماضي أو الآن ← قراءةٌ فقط', () => {
    expect(sessionCanWrite({ write_until: '2026-10-20T09:59:00Z' }, now)).toBe(false)
    expect(sessionCanWrite({ write_until: '2026-10-20T10:00:00Z' }, now)).toBe(false)
  })
  it('نافذةٌ في المستقبل ← تكتب', () => {
    expect(sessionCanWrite({ write_until: '2026-10-20T10:05:00Z' }, now)).toBe(true)
  })
  it('⚠️ المختومةُ والمنتهيةُ لا تكتب ولو بقيت نافذتُها', () => {
    expect(sessionCanWrite({ write_until: '2026-10-20T10:05:00Z', ended_at: '2026-10-20T09:58:00Z' }, now)).toBe(false)
    expect(sessionCanWrite({ write_until: '2026-10-20T10:05:00Z', expires_at: '2026-10-20T10:00:00Z' }, now)).toBe(false)
  })
})

describe('impersonationIsOpen', () => {
  it('قائمةٌ ما لم تُختم ولم تنتهِ', () => {
    expect(impersonationIsOpen({ ended_at: null, expires_at: '2026-10-20T10:10:00Z' }, now)).toBe(true)
    expect(impersonationIsOpen({ ended_at: '2026-10-20T09:00:00Z', expires_at: '2026-10-20T10:10:00Z' }, now)).toBe(false)
    expect(impersonationIsOpen({ ended_at: null, expires_at: '2026-10-20T10:00:00Z' }, now)).toBe(false)
  })
})

describe('isLiveSessionResult', () => {
  it('حيّةٌ إن عرفها GoTrue لصاحب الادّعاء', () => {
    expect(isLiveSessionResult({ data: { user: { id: 'u' } }, error: null }, 'u')).toBe(true)
  })
  it('ميّتةٌ بخطأ (session_not_found) أو بلا مستخدم أو لمستخدمٍ آخر', () => {
    expect(isLiveSessionResult({ data: { user: null }, error: { status: 403, code: 'session_not_found' } }, 'u')).toBe(false)
    expect(isLiveSessionResult({ data: { user: null }, error: null }, 'u')).toBe(false)
    expect(isLiveSessionResult({ data: null, error: null }, 'u')).toBe(false)
    expect(isLiveSessionResult({ data: { user: { id: 'other' } }, error: null }, 'u')).toBe(false)
  })
})
