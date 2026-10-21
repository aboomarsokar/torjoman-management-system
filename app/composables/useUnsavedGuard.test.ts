import { describe, expect, it, vi } from 'vitest'
import { blocksLeave } from './useUnsavedGuard'

describe('حارس التعديل غير المحفوظ', () => {
  it('لا تعديل: يمرّ بلا سؤال', () => {
    const ask = vi.fn(() => false)
    expect(blocksLeave(false, ask)).toBe(false)
    expect(ask).not.toHaveBeenCalled()
  })

  it('تعديلٌ ووافق على تركه: يمرّ', () => {
    expect(blocksLeave(true, () => true)).toBe(false)
  })

  it('تعديلٌ ورفض تركه: يُمنع', () => {
    expect(blocksLeave(true, () => false)).toBe(true)
  })
})
