import { describe, expect, it } from 'vitest'
import { addSeen } from './useFeatureSeen'

describe('addSeen', () => {
  it('يضيف الميزةَ مرّةً واحدة', () => {
    expect(addSeen([], 'halaqa-time')).toEqual(['halaqa-time'])
    expect(addSeen(['halaqa-time'], 'halaqa-time')).toEqual(['halaqa-time'])
  })
})
