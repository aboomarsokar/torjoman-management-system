/**
 * هل تكتب الجلسة؟ — تطابق private.session_is_read_only: بلا صفّ نيابةٍ تكتب، وبصفٍّ ما دامت النافذةُ مفتوحة.
 */
import { describe, expect, it, vi } from 'vitest'

// caller.ts يستورد عملاءَ Nuxt — والاختبارُ للدالّة النقيّة وحدها.
vi.mock('#supabase/server', () => ({ serverSupabaseServiceRole: vi.fn(), serverSupabaseUser: vi.fn() }))

const { sessionCanWrite } = await import('./caller')

describe('sessionCanWrite', () => {
  const now = Date.parse('2026-10-20T10:00:00Z')
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
})
