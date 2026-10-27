import { describe, expect, it } from 'vitest'
import { parseManualNumbers } from './useSms'

describe('parseManualNumbers', () => {
  it('سطراً سطراً أو بفواصل، ويُعدّ ما لم يُفهم', () => {
    const r = parseManualNumbers('0599123456\n+970569123456، 123\n\n')
    expect(r.list.map(x => x.phone)).toEqual(['0599123456', '0569123456'])
    expect(r.invalid).toBe(1)
  })
})
