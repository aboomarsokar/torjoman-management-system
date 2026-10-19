/**
 * رنّةُ الجرس: النغماتُ المجدولة (دِنْ دُنْ مرّتين) ومتى يرنّ.
 */
import { describe, expect, it } from 'vitest'
import { CHIME_TONES } from './useNotificationChime'

describe('CHIME_TONES', () => {
  it('نغمتان مكرّرتان مرّتين بفاصل 0.62', () => {
    expect(CHIME_TONES.map(t => [t.hz, Number(t.startsAt.toFixed(2)), t.seconds])).toEqual([
      [880, 0, 0.26], [660, 0.17, 0.42],
      [880, 0.62, 0.26], [660, 0.79, 0.42]
    ])
  })
})
