import { requireSmsSender } from '../../utils/smsSender'
import { requireWritableSession } from '../../utils/impersonationGuard'
import { MTC_CONCURRENCY, mtcErrorMessage, mtcSendOne, type MtcResult } from '../../utils/mtcSms'
import { SMS_MAX_SEGMENTS, SMS_REQUEST_CHUNK, normalizeLocalPhone, smsSegments } from '~/utils/sms'
import { renderInviteSms } from '~/utils/candidates'
import { MAX_INVITE_SMS_TEMPLATE } from '~/constants/candidates'

/**
 * رسالةُ دعوة المقابلة SMS للمرشّحين المدعوّين (طلب المستخدم 2026-10-30): المعرّفاتُ والصيغةُ (اختيارية — وإلا المعتمدةُ في
 * `app_settings`) من الواجهة، والنصُّ يُبنى هنا لكلّ مرشّحٍ باسمه وموعده ومكانه. `save` يجعل الصيغةَ معتمدة (للمدير الإداريّ وحده). المرسِلُ المدير الإداريّ وحده (قرار المستخدم 2026-10-30).
 * يُسجَّل كلُّ إرسالٍ في `sms_log`، ويُختم `invite_sms_at` لمن وصلته.
 */
export default defineEventHandler(async (event) => {
  const { admin, caller } = await requireSmsSender(event)
  if (caller.role !== 'admin_manager') throw createError({ statusCode: 403, statusMessage: 'رسائلُ المرشّحين للمدير الإداري وحده.' })
  requireWritableSession(caller)
  const body = await readBody<{ ids?: unknown, template?: unknown, save?: unknown }>(event)
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string'))] : []
  if (!ids.length) throw createError({ statusCode: 400, statusMessage: 'اختر مرشّحاً واحداً على الأقلّ.' })
  if (ids.length > SMS_REQUEST_CHUNK) throw createError({ statusCode: 400, statusMessage: `المرشّحون في الطلب الواحد حتى ${SMS_REQUEST_CHUNK}.` })

  let template = typeof body?.template === 'string' ? body.template.trim() : ''
  if (template.length > MAX_INVITE_SMS_TEMPLATE) throw createError({ statusCode: 400, statusMessage: `الصيغة لا تتجاوز ${MAX_INVITE_SMS_TEMPLATE} حرف.` })
  if (!template) {
    const { data: settings } = await admin.from('app_settings').select('candidate_invite_sms').eq('id', 1).maybeSingle()
    template = settings?.candidate_invite_sms ?? ''
  }
  if (template.length < 10) throw createError({ statusCode: 400, statusMessage: 'اكتب نصّ الرسالة.' })

  const { data, error } = await admin.from('candidates')
    .select('id, full_name, gender, phone, status, interview_at, interview_place').in('id', ids)
  if (error) throw createError({ statusCode: 500, statusMessage: 'تعذّر تحميل المرشّحين.' })
  const rows = data ?? []
  const ready = rows.filter(c => c.status === 'invited' && c.interview_at && normalizeLocalPhone(c.phone))
  if (!ready.length) throw createError({ statusCode: 400, statusMessage: 'لا مرشّحَ مدعوٌّ بموعدٍ ورقمٍ صالح بين المحدّدين.' })

  const messages = ready.map(c => renderInviteSms(template, { ...c, interview_at: c.interview_at! }))
  if (messages.some(m => smsSegments(m).segments > SMS_MAX_SEGMENTS)) {
    throw createError({ statusCode: 400, statusMessage: `الرسالة أطول من ${SMS_MAX_SEGMENTS} مقاطع — اختصرها.` })
  }
  if (body?.save === true) {
    const { error: saveError } = await admin.from('app_settings').update({ candidate_invite_sms: template }).eq('id', 1)
    if (saveError) throw createError({ statusCode: 500, statusMessage: 'تعذّر حفظ الصيغة.' })
  }
  const results: (MtcResult | null)[] = ready.map(() => null)
  let next = 0
  async function worker() {
    while (next < ready.length) {
      const i = next++
      results[i] = await mtcSendOne(normalizeLocalPhone(ready[i]!.phone)!, messages[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(MTC_CONCURRENCY, ready.length) }, worker))

  const okIds = ready.filter((_, i) => results[i]?.ok).map(c => c.id)
  if (okIds.length) await admin.from('candidates').update({ invite_sms_at: new Date().toISOString() }).in('id', okIds)
  await admin.from('sms_log').insert(ready.map((c, i) => {
    const r = results[i]
    const err = r && !r.ok ? (r.code === 'net' ? r.text : mtcErrorMessage(r.code)) : null
    return {
      body: messages[i]!,
      recipients: [{ name: c.full_name, phone: normalizeLocalPhone(c.phone), ok: r?.ok ?? false, code: r?.code ?? 'skipped' }],
      recipients_count: 1,
      segments: smsSegments(messages[i]!).segments,
      ok: r?.ok ?? false,
      code: (r?.code ?? 'skipped').slice(0, 20),
      result: `دعوة مقابلة — ${r?.ok ? 'وصلت' : `لم تصل${err ? `: ${err}` : ''}`}`.slice(0, 300),
      sent_by: caller.id
    }
  }))

  const firstBad = results.find(r => r && !r.ok)
  return {
    sent: okIds.length,
    failed: ready.length - okIds.length,
    skipped: ids.length - ready.length,
    error: firstBad ? (firstBad.code === 'net' ? firstBad.text : mtcErrorMessage(firstBad.code)) : null
  }
})
