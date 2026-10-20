import { describe, expect, it, vi } from 'vitest'
import { once } from './once'

describe('التسجيل مرّةً واحدة لكلّ هدف', () => {
  it('يستدعي التسجيلَ في المرّة الأولى وحدها مهما تكرّر النداء', () => {
    const app = {}
    const key = Symbol('k')
    const register = vi.fn()
    for (let i = 0; i < 27; i++) once(app, key, register)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('هدفٌ آخر (تطبيقٌ جديد) يُسجَّل له من جديد', () => {
    const key = Symbol('k')
    const register = vi.fn()
    once({}, key, register)
    once({}, key, register)
    expect(register).toHaveBeenCalledTimes(2)
  })

  it('مفتاحان على الهدف نفسه لا يتداخلان', () => {
    const app = {}
    const a = vi.fn()
    const b = vi.fn()
    once(app, Symbol('a'), a)
    once(app, Symbol('b'), b)
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1])
  })
})
