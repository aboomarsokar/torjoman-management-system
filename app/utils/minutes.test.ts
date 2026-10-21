import { describe, expect, it } from 'vitest'
import { MINUTE_SECTIONS, emptyMinuteForm, minuteDate, minuteItems, minutePayload, minutePdfTitle } from './minutes'

describe('minuteItems', () => {
  it('سطرٌ لكلّ بند، بلا أسطر فارغة ولا مسافات طرفيّة', () => {
    expect(minuteItems('النقاش في المسابقة\n\n  تخليص الأمور المالية  \r\nالختمات\n')).toEqual([
      'النقاش في المسابقة',
      'تخليص الأمور المالية',
      'الختمات'
    ])
  })

  it('يُسقط الترقيمَ والتنقيطَ المكتوبَين يدويّاً', () => {
    expect(minuteItems('1. أوّل\n٢- ثانٍ\n(3) ثالث\n- رابع\n• خامس\n١٠) عاشر')).toEqual([
      'أوّل', 'ثانٍ', 'ثالث', 'رابع', 'خامس', 'عاشر'
    ])
  })

  it('لا يمسّ رقماً هو جزءٌ من البند', () => {
    expect(minuteItems('صرف 250 شيكلاً للمواصلات\n2026 سنةُ الإطلاق')).toEqual([
      'صرف 250 شيكلاً للمواصلات',
      '2026 سنةُ الإطلاق'
    ])
  })

  it('الفارغُ وnull لا بنودَ فيهما', () => {
    expect(minuteItems('')).toEqual([])
    expect(minuteItems(null)).toEqual([])
    expect(minuteItems(' \n \n')).toEqual([])
  })
})

describe('minutePayload', () => {
  it('يشذّب ويجعل الفارغَ null ويأخذ الحالة من الزرّ', () => {
    const form = { ...emptyMinuteForm('2026-10-21'), title: '  اجتماع الإدارة ', agenda: 'بند\n', deferred_items: '   ', attendees: ['a', 'b'] }
    expect(minutePayload(form, 'final')).toEqual({
      title: 'اجتماع الإدارة',
      meeting_date: '2026-10-21',
      attendee_ids: ['a', 'b'],
      agenda: 'بند',
      decisions: null,
      deferred_items: null,
      tasks: null,
      status: 'final'
    })
  })

  it('لا يشارك النموذجَ مصفوفةَ الحاضرين', () => {
    const form = { ...emptyMinuteForm('2026-10-21'), attendees: ['a'] }
    const p = minutePayload(form, 'draft')
    form.attendees.push('b')
    expect(p.attendee_ids).toEqual(['a'])
  })
})

describe('minuteDate', () => {
  it('بالأرقام يوماً/شهراً/سنةً', () => {
    expect(minuteDate('2026-10-21')).toBe('21/10/2026')
    expect(minuteDate('2026-01-05T00:00:00Z')).toBe('05/01/2026')
  })
})

describe('minutePdfTitle', () => {
  it('محضر — العنوان — التاريخ بشُرَط', () => {
    expect(minutePdfTitle({ title: 'اجتماع الإدارة', meeting_date: '2026-10-21' })).toBe('محضر — اجتماع الإدارة — 21-10-2026')
  })

  it('يُسقط محارفَ أسماء الملفّات الممنوعة ويضمّ المسافات', () => {
    expect(minutePdfTitle({ title: ' المالية/الرواتب:  "تشرين" ', meeting_date: '2026-10-21' })).toBe('محضر — المالية الرواتب تشرين — 21-10-2026')
  })
})

describe('MINUTE_SECTIONS', () => {
  it('الأمورُ المؤجّلة بعد القرارات وقبل المهام', () => {
    expect(MINUTE_SECTIONS.map(s => s.key)).toEqual(['agenda', 'decisions', 'deferred_items', 'tasks'])
  })
})
