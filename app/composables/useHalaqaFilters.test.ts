import { describe, expect, it } from 'vitest'
import { supervisorMap } from './useHalaqaFilters'

describe('مشرفو الحلقات لفلاتر القوائم', () => {
  it('الحلقةُ بمشرفها، والتي بلا مشرفٍ غائبة', () => {
    const m = supervisorMap([
      { id: 'h1', supervisor: { id: 's1', full_name: 'مها' } },
      { id: 'h2', supervisor: null }
    ])
    expect(m.get('h1')).toEqual({ id: 's1', name: 'مها' })
    expect(m.has('h2')).toBe(false)
    expect(m.size).toBe(1)
  })
})
