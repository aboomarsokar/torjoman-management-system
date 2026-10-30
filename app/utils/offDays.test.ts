import { describe, expect, it } from 'vitest'
import { OFF_REASON_LABELS, OFF_REASONS, offDayBlock, offInputError, offStatusLabel, type ShownOff } from './offDays'

describe('offInputError', () => {
  it('بلا سبب: اختر سبباً', () => {
    expect(offInputError(null, '')).toBe('اختر سبباً')
  })

  it('«سببٌ آخر» بملاحظةٍ فارغةٍ بعد التشذيب مرفوض، وغيره بلا ملاحظةٍ جائز', () => {
    expect(offInputError('other', '  ')).toBe('اكتب السببَ في الملاحظة')
    expect(offInputError('other', 'تعطّل المبنى')).toBeNull()
    expect(offInputError('security', '')).toBeNull()
  })

  it('الملاحظةُ حتى 300 حرف', () => {
    expect(offInputError('security', 'ا'.repeat(300))).toBeNull()
    expect(offInputError('security', 'ا'.repeat(301))).toBe('الملاحظة أطول من 300 حرف')
  })
})

describe('OFF_REASON_LABELS', () => {
  it('تسميةٌ لكلّ سبب', () => {
    expect(OFF_REASONS.map(r => OFF_REASON_LABELS[r])).toEqual(['عطلة رسمية', 'ظرف أمني', 'مرض المعلم أو عذر طارئ', 'سبب آخر'])
  })
})

describe('offDayBlock', () => {
  const today = '2026-11-01'

  it('آخرُ يومٍ من الشهر السابق مفتوحٌ ما دام الشهرُ غيرَ معتمَد', () => {
    expect(offDayBlock('2026-10-31', today, [], {})).toBeNull()
    expect(offDayBlock('2026-11-01', today, [], {})).toBeNull()
  })

  it('قبل بداية المشروع', () => {
    expect(offDayBlock('2026-09-30', today, [], {})).toBe('قبل بداية المشروع')
  })

  it('الجمعةُ (2026-10-30)', () => {
    expect(offDayBlock('2026-10-30', today, [], {})).toBe('الجمعة عطلة — لا بلاغ فيها')
  })

  it('يومٌ لم يأتِ', () => {
    expect(offDayBlock('2026-11-02', today, [], {})).toBe('لا بلاغ عن يومٍ لم يأتِ')
  })

  it('شهرٌ معتمَد', () => {
    expect(offDayBlock('2026-10-31', today, ['2026-10'], {})).toBe('الشهر معتمَد — لا بلاغ بعد اعتماده')
  })

  it('إجازةٌ عامة', () => {
    expect(offDayBlock('2026-10-29', today, [], { '2026-10-29': 'عيد' })).toBe('هذا اليوم إجازةٌ عامة — لا يحتاج بلاغاً')
  })

  it('أقدمُ من الشهر السابق', () => {
    expect(offDayBlock('2026-10-31', '2026-12-02', [], {})).toBe('البلاغُ لأيام هذا الشهر والذي قبله')
    expect(offDayBlock('2026-11-01', '2026-12-02', [], {})).toBeNull()
  })

  it('مطلعُ السنة: الشهرُ السابق لكانون الثاني هو كانون الأول', () => {
    expect(offDayBlock('2026-12-31', '2027-01-02', [], {})).toBeNull()
    expect(offDayBlock('2026-11-30', '2027-01-02', [], {})).toBe('البلاغُ لأيام هذا الشهر والذي قبله')
  })

  it('الترتيب كالقاعدة: الجمعةُ قبل الإجازة، والشهرُ المعتمَد قبل الإجازة', () => {
    expect(offDayBlock('2026-10-30', today, [], { '2026-10-30': 'عيد' })).toBe('الجمعة عطلة — لا بلاغ فيها')
    expect(offDayBlock('2026-10-29', today, ['2026-10'], { '2026-10-29': 'عيد' })).toBe('الشهر معتمَد — لا بلاغ بعد اعتماده')
  })
})

describe('offStatusLabel', () => {
  const base: ShownOff = { reason: 'security', note: null, status: 'pending', reviewNote: null, queued: false }
  it('نصٌّ لكلّ حالة، وما على الجهاز يغلب', () => {
    expect(offStatusLabel({ ...base, queued: true })).toBe('على جهازك — بانتظار الرفع')
    expect(offStatusLabel({ ...base, queued: true, status: 'approved' })).toBe('على جهازك — بانتظار الرفع')
    expect(offStatusLabel(base)).toBe('بانتظار الاعتماد')
    expect(offStatusLabel({ ...base, status: 'approved' })).toBe('معتمَد')
    expect(offStatusLabel({ ...base, status: 'rejected' })).toBe('مرفوض')
  })
})
