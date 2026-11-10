import { describe, expect, it } from 'vitest'
import { cycleFromQuery } from './useExamQueueFilters'

describe('دورةُ طابور الرصد في الرابط', () => {
  it('المعرّفُ كما هو، والغائبُ والفارغُ والمكرّر ← كلّ الدورات', () => {
    expect(cycleFromQuery('c1')).toBe('c1')
    expect(cycleFromQuery(undefined)).toBe('all')
    expect(cycleFromQuery('')).toBe('all')
    expect(cycleFromQuery(['c1'])).toBe('all')
  })
})
