import { requireAdminManager } from '../../utils/supabaseAdmin'
import { requireWritableSession } from '../../utils/impersonationGuard'
import { MTC_CONCURRENCY, mtcErrorMessage, mtcSendOne, type MtcResult } from '../../utils/mtcSms'
import { SMS_MAX_SEGMENTS, SMS_REQUEST_CHUNK, dedupeRecipients, smsSegments } from '~/utils/sms'

/** رموزُ خطأ الحساب (كلمةُ مرور، مرسل، رصيد، إيقاف، منعُ الـAPI) — تتكرّر لكلّ رقم، فيتوقّف الإرسالُ عند أوّلها. */
const ACCOUNT_ERRORS = ['10002', '10004', '10005', '10008', '10011']

/**
 * إرسالُ رسالة SMS (المدير الإداري فقط — طلب المستخدم 2026-10-27): النصُّ ومستلمون `{ name?, phone }` (حتى
 * `SMS_REQUEST_CHUNK` في الطلب — والواجهةُ تقسّم ما زاد). تُطبَّع الأرقام ويُسقط المكرَّر، ويُرسَل لكلّ رقمٍ طلبٌ مستقلّ
 * (`MTC_CONCURRENCY` متزامنة)، ويُسجَّل الطلبُ في `sms_log` بنتيجة كلّ رقم. يُعيد من وصلهم ومن تعثّر وأوّلَ خطأٍ بالعربية.
 */
export default defineEventHandler(async (event) => {
  const { admin, user, caller } = await requireAdminManager(event)
  requireWritableSession(caller)
  const body = await readBody<{ message?: unknown, recipients?: unknown }>(event)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) throw createError({ statusCode: 400, statusMessage: 'اكتب نصّ الرسالة.' })
  const seg = smsSegments(message)
  if (seg.segments > SMS_MAX_SEGMENTS) throw createError({ statusCode: 400, statusMessage: `الرسالة أطول من ${SMS_MAX_SEGMENTS} مقاطع — اختصرها.` })

  const raw = Array.isArray(body?.recipients) ? body.recipients as { name?: unknown, phone?: unknown }[] : []
  const { valid, invalid } = dedupeRecipients(raw.map(r => ({
    name: typeof r?.name === 'string' ? r.name.slice(0, 120) : null,
    phone: typeof r?.phone === 'string' ? r.phone : null
  })))
  if (!valid.length) throw createError({ statusCode: 400, statusMessage: 'لا رقمَ جوالٍ صالح بين المستلمين.' })
  if (valid.length > SMS_REQUEST_CHUNK) throw createError({ statusCode: 400, statusMessage: `المستلمون في الطلب الواحد حتى ${SMS_REQUEST_CHUNK}.` })

  const results: (MtcResult | null)[] = Array.from({ length: valid.length }, () => null)
  let stop = false
  let next = 0
  async function worker() {
    while (!stop && next < valid.length) {
      const i = next++
      const r = await mtcSendOne(valid[i]!.phone, message)
      results[i] = r
      if (!r.ok && ACCOUNT_ERRORS.includes(r.code)) stop = true
    }
  }
  await Promise.all(Array.from({ length: Math.min(MTC_CONCURRENCY, valid.length) }, worker))

  const sent = results.filter(r => r?.ok).length
  const failed = valid.length - sent
  const firstBad = results.find(r => r && !r.ok)
  const error = firstBad ? (firstBad.code === 'net' ? firstBad.text : mtcErrorMessage(firstBad.code)) : null

  await admin.from('sms_log').insert({
    body: message,
    recipients: valid.map((r, i) => ({ ...r, ok: results[i]?.ok ?? false, code: results[i]?.code ?? 'skipped' })),
    recipients_count: valid.length,
    segments: seg.segments,
    ok: failed === 0,
    code: (firstBad?.code ?? (failed ? 'skipped' : '0')).slice(0, 20),
    result: `${sent} من ${valid.length}${error ? ` — ${error}` : ''}`.slice(0, 300),
    sent_by: user.id
  })

  return { sent, failed, invalid, segments: seg.segments, error }
})
