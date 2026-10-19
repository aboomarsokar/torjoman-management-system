/**
 * رنّةُ الجرس: النغماتُ المجدولة (دِنْ دُنْ مرّتين) ومتى يرنّ.
 */
import { describe, expect, it } from 'vitest'
import { CHIME_TONES, ringDecision, shouldRing } from './useNotificationChime'

describe('CHIME_TONES', () => {
  it('نغمتان مكرّرتان مرّتين بفاصل 0.62', () => {
    expect(CHIME_TONES.map(t => [t.hz, Number(t.startsAt.toFixed(2)), t.seconds])).toEqual([
      [880, 0, 0.26], [660, 0.17, 0.42],
      [880, 0.62, 0.26], [660, 0.79, 0.42]
    ])
  })
})

describe('shouldRing', () => {
  it.each([
    [null, 0, false],
    [null, 2, true],
    [1, 2, true],
    [2, 2, false],
    [3, 1, false],
    [0, 0, false]
  ] as const)('قبل %s ← بعد %s = %s', (before, next, expected) => {
    expect(shouldRing(before, next)).toBe(expected)
  })
})

describe('ringDecision', () => {
  it('قبل أوّل قراءة ناجحة: لا رنين ويبقى الأساس null (الصفر الابتدائيّ لا يستهلك «أوّل قراءة»)', () => {
    expect(ringDecision(null, 0, false)).toEqual({ known: null, ring: false })
    expect(ringDecision(3, 0, false)).toEqual({ known: null, ring: false })
  })

  it('أوّل قراءة بعد التحميل وفيها غير مقروء: يرنّ مرّةً ويصير الأساس العدد', () => {
    expect(ringDecision(null, 4, true)).toEqual({ known: 4, ring: true })
  })

  it('أوّل قراءة بلا غير مقروء: لا رنين، ثم أوّل إشعارٍ بعدها يرنّ', () => {
    const first = ringDecision(null, 0, true)
    expect(first).toEqual({ known: 0, ring: false })
    expect(ringDecision(first.known, 1, true)).toEqual({ known: 1, ring: true })
  })

  it('النقصان (التعليم بالقراءة) يحدّث الأساس بلا رنين', () => {
    expect(ringDecision(3, 1, true)).toEqual({ known: 1, ring: false })
  })
})
