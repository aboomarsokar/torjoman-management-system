/** المطلوبُ الشهريّ مُقسَّطاً بالحضور، وحكمُ الإنجاز. */
import { describe, expect, it } from 'vitest'
import { OUTCOME_LABELS, outcomeOf, proratePlan } from './plan'

describe('proratePlan', () => {
  it('بلا خطة: لا مطلوب', () => {
    expect(proratePlan({ required: null, daysHeld: 25, daysAttended: 20 }))
      .toEqual({ required: null, full: null, basis: 'full' })
  })

  it('أيامُ الحلقة صفرٌ أو مجهولة أو الحضورُ مجهول: المطلوبُ كاملاً', () => {
    expect(proratePlan({ required: 35, daysHeld: 0, daysAttended: 0 }))
      .toEqual({ required: 35, full: 35, basis: 'full' })
    expect(proratePlan({ required: 35, daysHeld: null, daysAttended: 3 }))
      .toEqual({ required: 35, full: 35, basis: 'full' })
    expect(proratePlan({ required: 35, daysHeld: 25, daysAttended: null }))
      .toEqual({ required: 35, full: 35, basis: 'full' })
  })

  it('لم يحضر يوماً: لا مطلوب ولا يُقاس (absent)', () => {
    expect(proratePlan({ required: 35, daysHeld: 25, daysAttended: 0 }))
      .toEqual({ required: null, full: 35, basis: 'absent' })
  })

  it('حضر كلَّ الأيام: كاملاً', () => {
    expect(proratePlan({ required: 35, daysHeld: 25, daysAttended: 25 }))
      .toEqual({ required: 35, full: 35, basis: 'full' })
  })

  it('20 يوماً من 25 بمطلوب 35 ← 28 (prorated)', () => {
    expect(proratePlan({ required: 35, daysHeld: 25, daysAttended: 20 }))
      .toEqual({ required: 28, full: 35, basis: 'prorated' })
  })

  it('لا يقلّ عن صفحةٍ لمن حضر ولو يوماً', () => {
    expect(proratePlan({ required: 14, daysHeld: 26, daysAttended: 1 }).required).toBe(1)
  })

  it('التقريبُ إلى الأقرب: 14 × 17/26 = 9.15 ← 9', () => {
    expect(proratePlan({ required: 14, daysHeld: 26, daysAttended: 17 }).required).toBe(9)
  })
})

describe('outcomeOf', () => {
  const full = { required: 28, full: 35, basis: 'prorated' } as const

  it('لم يُرصد حين الصفحاتُ null', () => {
    expect(outcomeOf(null, full)).toBe('unrecorded')
  })

  it('لا يُقاس حين لا مطلوب', () => {
    expect(outcomeOf(10, { required: null, full: 35, basis: 'absent' })).toBe('unmeasured')
  })

  it('أنجز عند بلوغ المطلوب أو تجاوزه، ومقصّر دونه', () => {
    expect(outcomeOf(28, full)).toBe('done')
    expect(outcomeOf(40, full)).toBe('done')
    expect(outcomeOf(27, full)).toBe('short')
    expect(outcomeOf(0, full)).toBe('short')
  })

  it('التسميات', () => {
    expect(OUTCOME_LABELS).toEqual({ done: 'أنجز', short: 'مقصّر', unmeasured: 'لا يُقاس', unrecorded: 'لم يُرصد' })
  })
})
