import { describe, expect, it } from 'vitest'
import { warmDue } from './useWarmTeacherMirrors'

describe('warmDue', () => {
  const at = 1_000_000
  it('أوّلَ مرّة، ولمعلّمٍ آخر على الجهاز', () => {
    expect(warmDue(null, 'u', at)).toBe(true)
    expect(warmDue({ uid: 'x', at }, 'u', at)).toBe(true)
  })
  it('مرّةً كلَّ ساعة', () => {
    expect(warmDue({ uid: 'u', at }, 'u', at + 15 * 60_000)).toBe(false)
    expect(warmDue({ uid: 'u', at }, 'u', at + 60 * 60_000)).toBe(true)
  })
  it('وبمهلةٍ أخرى (يوميّاً للشاشات التي تُقرأ)', () => {
    expect(warmDue({ uid: 'u', at }, 'u', at + 2 * 60 * 60_000, 24 * 60 * 60_000)).toBe(false)
  })
})
