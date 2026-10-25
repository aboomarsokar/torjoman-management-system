import { describe, expect, it } from 'vitest'
import { unseenKeys } from './useNavNewBadges'

describe('unseenKeys', () => {
  const items = [{ key: 'a', isNew: true }, { key: 'b' }, { key: 'c', isNew: true }]

  it('يعرض الشارة على الجديد غير المزور وحده', () => {
    expect([...unseenKeys(items, new Set(['c']))]).toEqual(['a'])
  })

  it('لا شارة على بندٍ غير موسوم ولو لم يُزر', () => {
    expect(unseenKeys(items, new Set()).has('b')).toBe(false)
  })
})
