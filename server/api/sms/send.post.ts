import { requireAdminManager } from '../../utils/supabaseAdmin'
import { requireWritableSession } from '../../utils/impersonationGuard'
import { MTC_BATCH, mtcErrorMessage, mtcSendBatch } from '../../utils/mtcSms'
import { SMS_MAX_RECIPIENTS, SMS_MAX_SEGMENTS, dedupeRecipients, smsSegments } from '~/utils/sms'

/**
 * إرسالُ رسالة SMS (المدير الإداري فقط — طلب المستخدم 2026-10-27): النصُّ ومستلمون `{ name?, phone }` من الكادر أو
 * جهات الاتصال أو أرقامٍ يدوية. تُطبَّع الأرقام ويُسقط المكرَّر، وتُرسَل على دفعاتٍ إلى MTC، وتُسجَّل كلُّ دفعةٍ بنتيجتها
 * في `sms_log`. يُعيد عددَ من وصلهم الإرسالُ ومن تعثّر، ورسالةَ أوّل خطأ بالعربية.
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
  if (valid.length > SMS_MAX_RECIPIENTS) throw createError({ statusCode: 400, statusMessage: `المستلمون أكثر من ${SMS_MAX_RECIPIENTS} — قسّمهم على دفعات.` })

  let sent = 0
  let failed = 0
  let firstError: string | null = null
  for (let i = 0; i < valid.length; i += MTC_BATCH) {
    const batch = valid.slice(i, i + MTC_BATCH)
    const result = await mtcSendBatch(batch.map(r => r.phone), message)
    if (result.ok) sent += batch.length
    else {
      failed += batch.length
      firstError ??= result.code === 'net' ? result.text : mtcErrorMessage(result.code)
    }
    await admin.from('sms_log').insert({
      body: message,
      recipients: batch,
      recipients_count: batch.length,
      segments: seg.segments,
      ok: result.ok,
      code: result.code.slice(0, 20),
      result: result.text.slice(0, 300) || null,
      sent_by: user.id
    })
    // خطأُ الحساب (كلمةُ مرور أو رصيد أو إيقاف) يتكرّر في كلّ دفعة — فلا داعي لإكمالها
    if (!result.ok && ['10002', '10004', '10005', '10008', '10011'].includes(result.code)) {
      failed += valid.length - (i + batch.length)
      break
    }
  }

  return { sent, failed, invalid, segments: seg.segments, error: firstError }
})
