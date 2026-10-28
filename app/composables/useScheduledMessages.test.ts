import { describe, expect, it } from 'vitest'
import { blankSchedule, describeSchedule, gazaLocalToIso, scheduleError } from './useScheduledMessages'

describe('describeSchedule', () => {
  it('أسبوعيٌّ وشهريّ', () => {
    expect(describeSchedule({ recurrence: 'weekly', weekday: 6, time_of_day: '08:00:00', month_day: null, run_at: null })).toBe('كلَّ السبت · 8:00 ص')
    expect(describeSchedule({ recurrence: 'monthly', month_day: 28, time_of_day: '21:30:00', weekday: null, run_at: null })).toBe('كلَّ شهر يوم 28 · 9:30 م')
  })
  it('مرّةً بتوقيت غزة', () => {
    expect(describeSchedule({ recurrence: 'once', run_at: '2026-10-31T14:00:00Z', weekday: null, month_day: null, time_of_day: null })).toBe('مرّةً 31-10-2026 · 4:00 م')
  })
})

describe('gazaLocalToIso', () => {
  it('غزة +02 بعد نهاية التوقيت الصيفيّ', () => {
    expect(gazaLocalToIso('2026-12-01', '16:00')).toBe('2026-12-01T14:00:00.000Z')
  })
  it('وغزة +03 صيفاً', () => {
    expect(gazaLocalToIso('2026-07-01', '16:00')).toBe('2026-07-01T13:00:00.000Z')
  })
})

describe('scheduleError', () => {
  it('يقبل الأسبوعيّ الافتراضيّ بعنوان', () => {
    expect(scheduleError({ ...blankSchedule(), title: 'اجتماع' })).toBeNull()
  })
  it('يطلب العنوان والفئة والقناة واليوم للمرّة', () => {
    expect(scheduleError(blankSchedule())).toBe('اكتب عنوان الرسالة.')
    expect(scheduleError({ ...blankSchedule(), title: 'x', roles: [] })).toBe('اختر فئةً واحدةً على الأقلّ.')
    expect(scheduleError({ ...blankSchedule(), title: 'x', in_app: false })).toBe('اختر قناةً واحدةً على الأقلّ.')
    expect(scheduleError({ ...blankSchedule(), title: 'x', recurrence: 'once' })).toBe('اختر اليوم.')
  })
})
