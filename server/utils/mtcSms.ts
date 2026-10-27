/**
 * مزوّدُ الرسائل MTC (طلب المستخدم 2026-10-27) — عبر HTTPS ومن الخادم وحده: اسمُ المستخدم وكلمةُ المرور واسمُ المرسل
 * في متغيّرات البيئة (`NUXT_MTC_SMS_USERNAME` و`NUXT_MTC_SMS_PASSWORD` و`NUXT_MTC_SMS_SENDER`) ولا تُسجَّل.
 * الردُّ نصٌّ «الرمز@الوصف»: 0 نجاح، وغيرُه خطأٌ يُترجم إلى العربية.
 */
import { toInternational } from '~/utils/sms'

// خدمةُ الويب بصيغة SOAP (جُرّبت مع المستخدم 2026-10-27): رابطُ `int.mtcsms.com/sendsms.aspx` يردّ 10011 «API access denied»
// لهذا الحساب، ونموذجُ POST العاديّ يصل عربيُّه مشوّهاً (يُقرأ Windows-1256)، والنوعُ 1 (Hex) يصل أرقاماً؛ أمّا SOAP
// فيُصرّح بـUTF-8 في الطلب نفسه فيصل العربيُّ سليماً. الردّ XML فيه «0@Message Sent».
const SEND_URL = 'https://api.mtcsms.com/sendsms.asmx'
const SOAP_ACTION = '"http://tempuri.org/SendMessage"'
const BALANCE_URL = 'https://api.mtcsms.com/balance.aspx'
/** أرقامٌ في الطلب الواحد إلى المزوّد. */
export const MTC_BATCH = 100

const ERRORS: Record<string, string> = {
  10002: 'اسم المستخدم أو كلمة المرور لحساب الرسائل غير صحيحة.',
  10003: 'حقلٌ ناقص في طلب الإرسال.',
  10004: 'اسم المرسل غير مسموح — سجّله عند المزوّد.',
  10005: 'رصيد الرسائل غير كافٍ.',
  10008: 'حساب الرسائل موقوف عند المزوّد.',
  10011: 'الإرسال عبر الـ API غير مسموح لهذا الحساب عند المزوّد.'
}

export interface MtcResult { ok: boolean, code: string, text: string }

/** «0@Message Sent Successfully» (أو داخل XML خدمة الويب) ← { ok, code, text }؛ وما لا يُفهم خطأٌ برمز «?». */
export function parseMtcResponse(raw: string): MtcResult {
  const body = raw.replace(/<\?xml[^>]*\?>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const at = body.indexOf('@')
  const code = (at >= 0 ? body.slice(0, at) : body).trim()
  const text = at >= 0 ? body.slice(at + 1).trim() : ''
  if (!/^\d+$/.test(code)) return { ok: false, code: '?', text: body.slice(0, 200) }
  return { ok: code === '0', code, text }
}

/** وصفُ الرمز بالعربية. */
export function mtcErrorMessage(code: string): string {
  return ERRORS[code] ?? `رفض المزوّدُ الإرسال (الرمز ${code}).`
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** غلافُ SOAP لعملية SendMessage — القيمُ مُهرَّبة، والترميزُ UTF-8 مصرَّحٌ به. */
export function soapSendEnvelope(fields: Record<'Username' | 'Password' | 'Sender' | 'Mobile' | 'Msg' | 'Type' | 'Rule', string>): string {
  const inner = Object.entries(fields).map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`).join('')
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    + `<soap:Body><SendMessage xmlns="http://tempuri.org/">${inner}</SendMessage></soap:Body></soap:Envelope>`
}

interface MtcCreds { username: string, password: string, sender: string }

function creds(): MtcCreds {
  const c = useRuntimeConfig()
  const username = String(c.mtcSmsUsername ?? '')
  const password = String(c.mtcSmsPassword ?? '')
  const sender = String(c.mtcSmsSender ?? '')
  if (!username || !password || !sender) {
    throw createError({ statusCode: 503, statusMessage: 'حساب الرسائل غير مُعدّ بعد — أضف بياناته في إعدادات الخادم.' })
  }
  return { username, password, sender }
}

/** يرسل نصّاً واحداً لدفعةٍ من الأرقام المحلّية (05…) — المستدعي يقسّم إلى دفعات `MTC_BATCH`. */
export async function mtcSendBatch(localPhones: string[], message: string): Promise<MtcResult> {
  const { username, password, sender } = creds()
  const body = soapSendEnvelope({
    Username: username, Password: password, Sender: sender,
    Mobile: localPhones.map(toInternational).join(','), Msg: message, Type: '0', Rule: ''
  })
  try {
    const raw = await $fetch<string>(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': SOAP_ACTION },
      body,
      responseType: 'text',
      timeout: 20000
    })
    return parseMtcResponse(String(raw))
  } catch {
    return { ok: false, code: 'net', text: 'تعذّر الاتصال بمزوّد الرسائل.' }
  }
}

/** رصيدُ الحساب، أو خطأٌ مترجَم. */
export async function mtcBalance(): Promise<{ ok: true, balance: string } | { ok: false, message: string }> {
  const { username, password } = creds()
  const params = new URLSearchParams({ username, password })
  try {
    const r = parseMtcResponse(String(await $fetch<string>(`${BALANCE_URL}?${params.toString()}`, { responseType: 'text', timeout: 15000 })))
    return r.ok ? { ok: true, balance: r.text } : { ok: false, message: mtcErrorMessage(r.code) }
  } catch {
    return { ok: false, message: 'تعذّر الاتصال بمزوّد الرسائل.' }
  }
}
