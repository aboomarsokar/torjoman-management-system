import { describe, expect, it } from 'vitest'
import { mtcErrorMessage, parseMtcResponse, soapSendEnvelope } from './mtcSms'

describe('soapSendEnvelope', () => {
  it('يصرّح بـUTF-8 ويُهرّب القيم ويحفظ العربية', () => {
    const x = soapSendEnvelope({ Username: 'u&1', Password: 'p<2', Sender: 'Torjoman', Mobile: '970599123456', Msg: 'اجتماعُ السبت <4 م>', Type: '0', Rule: '' })
    expect(x.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true)
    expect(x).toContain('<Username>u&amp;1</Username>')
    expect(x).toContain('<Password>p&lt;2</Password>')
    expect(x).toContain('<Msg>اجتماعُ السبت &lt;4 م&gt;</Msg>')
    expect(x).toContain('<SendMessage xmlns="http://tempuri.org/">')
  })
})

describe('parseMtcResponse', () => {
  it('0@ نجاح', () => {
    expect(parseMtcResponse('0@Message Sent Successfully')).toEqual({ ok: true, code: '0', text: 'Message Sent Successfully' })
  })
  it('رموزُ الخطأ', () => {
    expect(parseMtcResponse('10005@Low Balance')).toMatchObject({ ok: false, code: '10005' })
    expect(parseMtcResponse(' 10002@Invalid Username or password. ')).toMatchObject({ ok: false, code: '10002' })
  })
  it('الرصيدُ في الوصف', () => {
    expect(parseMtcResponse('0@1250')).toEqual({ ok: true, code: '0', text: '1250' })
  })
  it('داخل XML خدمة الويب', () => {
    expect(parseMtcResponse('<?xml version="1.0" encoding="utf-8"?>\n<string xmlns="http://tempuri.org/">0@Message Sent</string>'))
      .toEqual({ ok: true, code: '0', text: 'Message Sent' })
  })
  it('ما لا يُفهم خطأ', () => {
    expect(parseMtcResponse('<html>error</html>')).toMatchObject({ ok: false, code: '?' })
  })
})

describe('mtcErrorMessage', () => {
  it('يترجم المعروف ويصف المجهول', () => {
    expect(mtcErrorMessage('10005')).toBe('رصيد الرسائل غير كافٍ.')
    expect(mtcErrorMessage('99')).toContain('99')
  })
})
