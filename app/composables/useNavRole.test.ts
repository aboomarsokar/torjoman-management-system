import { describe, expect, it } from 'vitest'
import { readCachedRole } from './useNavRole'

describe('readCachedRole', () => {
  it('دورُ المستخدم نفسه، ولا يُعطى لغيره', () => {
    expect(readCachedRole({ sub: 'u1', role: 'teacher' }, 'u1')).toBe('teacher')
    expect(readCachedRole({ sub: 'u1', role: 'teacher' }, 'u2')).toBeNull()
  })
  it('بلا معرّفٍ (على الخادم) يُعطى كما هو، والفارغُ لا شيء', () => {
    expect(readCachedRole({ sub: 'u1', role: 'teacher' }, null)).toBe('teacher')
    expect(readCachedRole(null, 'u1')).toBeNull()
    expect(readCachedRole({ sub: 'u1' }, 'u1')).toBeNull()
  })
})
