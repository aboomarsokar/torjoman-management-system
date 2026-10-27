import { describe, expect, it } from 'vitest'
import { parseRewrite, rewriteLimits, rewriteSystemPrompt } from './aiRewrite'

describe('rewriteLimits', () => {
  it('SMS حدُّ مقاطعه بلا عنوان، ورسالةُ الكادر حدّاها', () => {
    expect(rewriteLimits('sms')).toEqual({ title: 0, body: 402 })
    expect(rewriteLimits('announcement')).toEqual({ title: 120, body: 600 })
  })
})

describe('rewriteSystemPrompt', () => {
  it('اسمُ المنصّة والحفاظُ على المعلومات في كلّ صياغة', () => {
    const p = rewriteSystemPrompt('announcement', 'male')
    expect(p).toContain('«منصة ترجمان القرآنية»')
    expect(p).toContain('كما هي حرفياً')
    expect(p).toContain('لا يتجاوز 120 حرفاً')
  })
  it('البناتُ بصيغة المؤنّث وبلا قلوب، والمختلطُ بلا قلوب', () => {
    expect(rewriteSystemPrompt('sms', 'female')).toContain('لا تستعمل أيقونات القلوب')
    expect(rewriteSystemPrompt('sms', 'mixed')).toContain('لا تستعمل أيقونات القلوب')
    expect(rewriteSystemPrompt('sms', 'male')).not.toContain('القلوب')
  })
  it('SMS موجزةٌ بحدّها', () => {
    expect(rewriteSystemPrompt('sms', 'male')).toContain('لا تتجاوز 402 حرفاً')
  })
})

describe('parseRewrite', () => {
  it('يقرأ الحقلين ويقصّ على الحدود', () => {
    const out = parseRewrite(JSON.stringify({ title: '📌 '.padEnd(200, 'ع'), body: ' نصّ ' }), 'announcement')
    expect(out.title.length).toBe(120)
    expect(out.body).toBe('نصّ')
  })
  it('SMS بلا عنوان', () => {
    expect(parseRewrite(JSON.stringify({ title: 'x', body: 'تذكير 📅' }), 'sms')).toEqual({ title: '', body: 'تذكير 📅' })
  })
  it('يرفض ما ليس JSON أو الفارغ', () => {
    expect(() => parseRewrite('ليس JSON', 'sms')).toThrow()
    expect(() => parseRewrite('{"title":"","body":""}', 'sms')).toThrow()
  })
})
