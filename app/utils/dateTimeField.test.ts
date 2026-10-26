/**
 * حقل التاريخ والوقت — الفصل والجمع، وصيغة الوقت العربية، وخيارات الوقت.
 */
import { describe, expect, it } from 'vitest'
import { joinDateTime, normalizeSuggestedTime, splitDateTime, timeLabel, timeOptions } from './dateTimeField'

describe('splitDateTime / joinDateTime', () => {
  it('يفصل قيمة datetime-local ويجمعها', () => {
    expect(splitDateTime('2026-10-21T16:30')).toEqual({ date: '2026-10-21', time: '16:30' })
    expect(joinDateTime('2026-10-21', '16:30')).toBe('2026-10-21T16:30')
  })
  it('لا قيمة قبل اكتمال الاثنين، والفارغ فارغ', () => {
    expect(joinDateTime('2026-10-21', '')).toBe('')
    expect(splitDateTime('')).toEqual({ date: '', time: '' })
  })
})

describe('timeLabel', () => {
  it('اثنتا عشرة ساعة بصباح/مساء', () => {
    expect(timeLabel('16:30')).toBe('4:30 م')
    expect(timeLabel('09:05')).toBe('9:05 ص')
    expect(timeLabel('12:00')).toBe('12:00 م')
    expect(timeLabel('00:15')).toBe('12:15 ص')
  })
})

describe('timeOptions', () => {
  it('كل ربع ساعة من 6 إلى 22 مرتّبة', () => {
    const opts = timeOptions()
    expect(opts[0]).toEqual({ label: '6:00 ص', value: '06:00' })
    expect(opts.at(-1)?.value).toBe('22:00')
    expect(opts).toHaveLength(65)
  })
  it('يُدرج وقتاً خارج الشبكة ولا يكرّر ما عليها', () => {
    expect(timeOptions(['16:10']).map(o => o.value)).toContain('16:10')
    expect(timeOptions(['16:00'])).toHaveLength(65)
  })
})

describe('normalizeSuggestedTime', () => {
  it('يقبل HH:MM ويقصّ الثواني', () => {
    expect(normalizeSuggestedTime('16:00')).toBe('16:00')
    expect(normalizeSuggestedTime('16:00:00')).toBe('16:00')
  })
  it('يرفض صيغة العرض «4:00 م» والفارغ — كانت تُفسد موعد الزيارة', () => {
    expect(normalizeSuggestedTime('4:00 م')).toBe('')
    expect(normalizeSuggestedTime(null)).toBe('')
    expect(joinDateTime('2026-10-13', normalizeSuggestedTime('4:00 م'))).toBe('')
  })
})
