import { describe, expect, it } from 'vitest'
import { monthRange } from './useDataExport'

describe('monthRange', () => {
  it('أوّلُ الشهر وآخرُه', () => {
    expect(monthRange(2026, 10)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthRange(2027, 2)).toEqual({ from: '2027-02-01', to: '2027-02-28' })
  })
})
