/**
 * اختبارُ منطق «أيام الإجازة»: توسيعُ المدى بلا الجُمَع، وفصلُ الجديد عن المعيَّن، وترتيبُ القائمة، وتشذيبُ السبب، ونصُّ التأكيد.
 */
import { describe, expect, it } from 'vitest'
import { cleanHolidayReason, expandHolidayRange, holidayConfirmMessage, holidayHorizon, sortHolidays, splitNewHolidays } from './holidays'

describe('expandHolidayRange', () => {
  it('الخميس 5 والسبت 7 والأحد 8 بلا الجمعة 6', () => {
    expect(expandHolidayRange('2026-11-05', '2026-11-08')).toEqual(['2026-11-05', '2026-11-07', '2026-11-08'])
  })

  it('المدى المقلوبُ يعطي النتيجةَ نفسها', () => {
    expect(expandHolidayRange('2026-11-08', '2026-11-05')).toEqual(expandHolidayRange('2026-11-05', '2026-11-08'))
  })

  it('يومٌ واحدٌ إن تساوى الطرفان، وفارغٌ إن كان جمعة', () => {
    expect(expandHolidayRange('2026-11-05', '2026-11-05')).toEqual(['2026-11-05'])
    expect(expandHolidayRange('2026-11-06', '2026-11-06')).toEqual([])
  })

  it('يعبر حدَّ الشهر والسنة', () => {
    expect(expandHolidayRange('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-02'])
  })
})

describe('splitNewHolidays', () => {
  it('يتخطّى ما هو إجازةٌ أصلاً ويُبقي الترتيب', () => {
    const r = splitNewHolidays(['2026-11-05', '2026-11-07', '2026-11-08'], ['2026-11-07', '2026-12-01'])
    expect(r).toEqual({ fresh: ['2026-11-05', '2026-11-08'], skipped: ['2026-11-07'] })
  })
})

describe('sortHolidays', () => {
  it('القادمةُ تصاعدياً أولاً (واليومُ منها) ثم الماضيةُ من الأحدث', () => {
    const list = [
      { day: '2026-10-05' }, { day: '2026-11-20' }, { day: '2026-10-29' }, { day: '2026-11-02' }, { day: '2026-10-10' }
    ]
    expect(sortHolidays(list, '2026-11-02').map(h => h.day)).toEqual([
      '2026-11-02', '2026-11-20', '2026-10-29', '2026-10-10', '2026-10-05'
    ])
  })
})

describe('cleanHolidayReason', () => {
  it('يشذّب، ويرفض الفارغ وما فوق 80', () => {
    expect(cleanHolidayReason('  عيد  ')).toBe('عيد')
    expect(cleanHolidayReason('   ')).toBeNull()
    expect(cleanHolidayReason('ع'.repeat(80))).toHaveLength(80)
    expect(cleanHolidayReason('ع'.repeat(81))).toBeNull()
  })
})

describe('holidayHorizon', () => {
  it('اليومُ + أفق التعيين', () => {
    expect(holidayHorizon('2026-10-30')).toBe('2027-12-04')
  })
})

describe('holidayConfirmMessage', () => {
  it('يذكر الأيامَ والحلقات ويبقى الحضور كما هو', () => {
    expect(holidayConfirmMessage(3, 5, 0)).toBe('3 أيام، وسجّلت فيها 5 حلقة حضوراً يبقى كما هو.')
  })

  it('بلا حلقاتٍ مسجِّلة، ومع المتخطّى', () => {
    expect(holidayConfirmMessage(2, 0, 1)).toBe('يومان، ولم تسجّل فيها أيُّ حلقةٍ حضوراً. (تُخطّي يومٌ واحد: إجازةٌ أصلاً)')
  })

  it('عددُ الأيام بصيغته العربية: واحد · أحد عشر', () => {
    expect(holidayConfirmMessage(1, 2, 0)).toMatch(/^يومٌ واحد، /)
    expect(holidayConfirmMessage(11, 2, 0)).toMatch(/^11 يوماً، /)
  })
})
