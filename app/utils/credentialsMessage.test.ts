import { describe, expect, it } from 'vitest'
import { chatFor, teacherCredentialsMessage, whatsappFor, whatsappMessageLink } from './credentialsMessage'

const base = { teacherName: 'رشادالدين أشرف رشاد الحلو', studentName: 'مصطفى عاطف مصطفى التتر', nationalId: '432248433', password: 'Ab12-xy', female: false }

describe('teacherCredentialsMessage', () => {
  it('فيها الرابطُ والهويةُ والكلمة واسمُ المعلّم الأوّل', () => {
    const t = teacherCredentialsMessage(base)
    expect(t).toContain('أ. رشادالدين')
    expect(t).toContain('torjoman.org/login')
    expect(t).toContain('432248433')
    expect(t).toContain('Ab12-xy')
    expect(t).toContain('الطالب *مصطفى عاطف مصطفى التتر*')
    expect(t).not.toMatch(/🤍|❤/)
  })
  it('بصيغة المؤنّث للطالبة، وبلا اسمٍ إن غاب', () => {
    const t = teacherCredentialsMessage({ ...base, female: true, teacherName: null })
    expect(t.startsWith('السلام عليكم 🌿')).toBe(true)
    expect(t).toContain('الطالبة')
    expect(t).toContain('تختار')
  })
})

describe('teacherCredentialsMessage — المحادثة', () => {
  it('بلا نجوم واتساب ومعه تنبيهُ الكلمة المؤقّتة', () => {
    const t = teacherCredentialsMessage(base, true)
    expect(t).toContain('الطالب مصطفى عاطف مصطفى التتر على')
    expect(t).not.toContain('*')
    expect(t.endsWith('⚠️ الكلمةُ مؤقّتة وتبطل بعد أوّل دخول.')).toBe(true)
  })
})

describe('whatsappMessageLink', () => {
  it('يحوّل 05… إلى 970 ويُرمّز النصّ', () => {
    expect(whatsappMessageLink('0599123456', 'سلام عليكم')).toBe(`https://wa.me/970599123456?text=${encodeURIComponent('سلام عليكم')}`)
  })
  it('null بلا رقم', () => {
    expect(whatsappMessageLink(null, 'x')).toBeNull()
  })
})

describe('chatFor', () => {
  const res = { teacher_id: 't1', teacher_name: 'سجى حسن', full_name: 'آية أحمد', national_id: '432248433', temp_password: 'Ab12-xy', female: true }
  it('للمعلّمة بالمؤنّث وبالرسالة غير المنسّقة', () => {
    const c = chatFor(res)!
    expect(c.label).toBe('أرسلها للمعلّمة عبر المحادثة')
    expect(c.recipientId).toBe('t1')
    expect(c.text).toContain('Ab12-xy')
    expect(c.text).not.toContain('*')
  })
  it('null لحلقةٍ بلا معلّم', () => {
    expect(chatFor({ ...res, teacher_id: null })).toBeNull()
  })
})

describe('whatsappFor', () => {
  const res = { teacher_id: 't1', teacher_name: 'محمد عادل', teacher_phone: '0595985655', full_name: 'لانا ماهر', national_id: '430117606', temp_password: 'Ab12-xy', female: false }
  it('رابطُ واتساب المعلّم بالرسالة', () => {
    const w = whatsappFor(res)!
    expect(w.label).toBe('أرسلها للمعلّم على واتساب')
    expect(w.url).toContain('wa.me/970595985655')
    expect(decodeURIComponent(w.url)).toContain('430117606')
  })
  it('null بلا رقم', () => {
    expect(whatsappFor({ ...res, teacher_phone: null })).toBeNull()
  })
})
