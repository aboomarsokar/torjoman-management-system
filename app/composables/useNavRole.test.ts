import { describe, expect, it } from 'vitest'
import { readCachedRole } from './useNavRole'

describe('readCachedRole', () => {
  it('دورُ المستخدم نفسه وحده', () => {
    const raw = JSON.stringify({ sub: 'u1', role: 'teacher' })
    expect(readCachedRole(raw, 'u1')).toBe('teacher')
    expect(readCachedRole(raw, 'u2')).toBeNull()
  })
  it('الفارغُ والتالفُ وبلا مستخدم', () => {
    expect(readCachedRole(null, 'u1')).toBeNull()
    expect(readCachedRole('{oops', 'u1')).toBeNull()
    expect(readCachedRole(JSON.stringify({ sub: 'u1', role: 'teacher' }), null)).toBeNull()
  })
})
