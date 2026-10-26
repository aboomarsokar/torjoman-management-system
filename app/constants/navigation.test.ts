import { describe, expect, it } from 'vitest'
import { orderByKeys, TEACHER_NAV_ORDER } from './navigation'

describe('orderByKeys', () => {
  it('يرتّب بالمفاتيح وما لم يُذكر بعدها بترتيبه', () => {
    const items = [{ key: 'b' }, { key: 'x' }, { key: 'a' }, { key: 'y' }]
    expect(orderByKeys(items, ['a', 'b']).map(i => i.key)).toEqual(['a', 'b', 'x', 'y'])
  })

  it('الحضورُ ثاني بنود المعلّم بعد اللوحة', () => {
    expect(TEACHER_NAV_ORDER.slice(0, 2)).toEqual(['dashboard', 'attendance-offline'])
  })
})
