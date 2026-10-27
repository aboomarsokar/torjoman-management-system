/**
 * منطقُ رسائل SMS النقيّ (طلب المستخدم 2026-10-27) — يشاركه الخادمُ والواجهة: تطبيعُ الجوال، وحسابُ المقاطع.
 * النصُّ العربيّ يُرسَل Unicode: 70 حرفاً للمقطع الواحد و67 لكلّ مقطعٍ من رسالةٍ أطول؛ واللاتينيّ 160 ثم 153.
 */
import { normalizeDigits } from '~/constants/identity'

/** أقصى مقاطع الرسالة الواحدة (قيدُ `sms_log.segments`). */
export const SMS_MAX_SEGMENTS = 6
/** أقصى المستلمين في الإرسال الواحد. */
export const SMS_MAX_RECIPIENTS = 600

/** «0599 123 456» أو «+970599123456» أو «970599123456» ← «0599123456»؛ وغيرُ الجوال الفلسطينيّ ← null. */
export function normalizeLocalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = normalizeDigits(raw).replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('970') || d.startsWith('972')) d = `0${d.slice(3)}`
  if (/^5\d{8}$/.test(d)) d = `0${d}`
  return /^05\d{8}$/.test(d) ? d : null
}

/** «0599123456» ← «970599123456» (صيغةُ المزوّد الدولية بلا +). */
export function toInternational(local: string): string {
  return `970${local.slice(1)}`
}

/** هل في النصّ ما لا تحمله أبجديةُ GSM-7 (العربيةُ مثلاً)؟ */
export function needsUnicode(text: string): boolean {
  return /[^\n\r -~£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà€]/.test(text)
}

export interface SegmentInfo { length: number, segments: number, perSegment: number, unicode: boolean }

/** طولُ النصّ وعددُ مقاطعه وسعةُ المقطع. */
export function smsSegments(text: string): SegmentInfo {
  const unicode = needsUnicode(text)
  const length = [...text].length
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  const segments = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi)
  return { length, segments, perSegment: segments > 1 ? multi : single, unicode }
}

/** يُسقط المكرَّر وغيرَ الصالح، ويُبقي الاسمَ الأوّل لكلّ رقم. */
export function dedupeRecipients<T extends { phone: string | null | undefined, name?: string | null }>(list: T[]) {
  const seen = new Map<string, { phone: string, name: string | null }>()
  let invalid = 0
  for (const r of list) {
    const phone = normalizeLocalPhone(r.phone)
    if (!phone) {
      invalid++
      continue
    }
    if (!seen.has(phone)) seen.set(phone, { phone, name: r.name ?? null })
  }
  return { valid: [...seen.values()], invalid }
}
