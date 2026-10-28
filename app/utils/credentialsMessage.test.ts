import { describe, expect, it } from 'vitest'
import { teacherCredentialsMessage, whatsappMessageLink } from './credentialsMessage'

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
