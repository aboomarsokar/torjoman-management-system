import { describe, expect, it } from 'vitest'
import { choiceItems, RESIDENCE_AREAS, TAJWEED_LEVELS } from './profileChoices'

describe('choiceItems', () => {
  it('القائمةُ كما هي بلا قيمةٍ حالية أو بقيمةٍ منها', () => {
    expect(choiceItems(TAJWEED_LEVELS).map(i => i.value)).toEqual(['تأهيلية', 'عليا', 'تأهيل سند', 'سند'])
    expect(choiceItems(RESIDENCE_AREAS, 'غزة')).toHaveLength(6)
    expect(choiceItems(RESIDENCE_AREAS, 'شمال غزة')).toHaveLength(6)
  })

  it('القيمةُ القديمة خارج القائمة تبقى خياراً أخيراً', () => {
    expect(choiceItems(RESIDENCE_AREAS, 'رفح').at(-1)).toEqual({ label: 'رفح', value: 'رفح' })
  })
})
