import { requireSmsSender } from '../../utils/smsSender'
import { requireWritableSession } from '../../utils/impersonationGuard'
import { MTC_CONCURRENCY, mtcErrorMessage, mtcSendOne, type MtcResult } from '../../utils/mtcSms'
import { SMS_MAX_SEGMENTS, SMS_REQUEST_CHUNK, normalizeLocalPhone, smsSegments } from '~/utils/sms'
import { renderResultSms, resultKind } from '~/utils/candidates'
import { MAX_INVITE_SMS_TEMPLATE, RESULT_SMS_KINDS, type ResultSmsKind } from '~/constants/candidates'

/** عمودُ كلّ صيغةٍ في `app_settings`. */
const COLUMN = {
  accepted: 'candidate_result_sms_accepted',
  reserve: 'candidate_result_sms_reserve',
  rejected: 'candidate_result_sms_rejected'
} as const satisfies Record<ResultSmsKind, string>

/**
 * رسالةُ النتيجة SMS للمرشّحين المقرَّرين (طلب المستخدم 2026-10-31) — للمدير الإداريّ وحده كالدعوة. لكلّ حالةٍ صيغتُها
 * (مقبول · احتياط · مرفوض، والمعيَّنُ بصيغة المقبول): من الواجهة إن عُدّلت، وإلا المعتمدةُ في `app_settings`. `save`
 * يعتمد الصيغَ المرسَلة. يُسجَّل كلُّ إرسالٍ في `sms_log`، ويُختم `result_sms_at` لمن وصلته.
 */
export default defineEventHandler(async (event) => {
  const { admin, caller } = await requireSmsSender(event)
  if (caller.role !== 'admin_manager') throw createError({ statusCode: 403, statusMessage: 'رسائلُ المرشّحين للمدير الإداري وحده.' })
  requireWritableSession(caller)
  const body = await readBody<{ ids?: unknown, templates?: unknown, save?: unknown }>(event)
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string'))] : []
  if (!ids.length) throw createError({ statusCode: 400, statusMessage: 'اختر مرشّحاً واحداً على الأقلّ.' })
  if (ids.length > SMS_REQUEST_CHUNK) throw createError({ statusCode: 400, statusMessage: `المرشّحون في الطلب الواحد حتى ${SMS_REQUEST_CHUNK}.` })

  const { data: settings } = await admin.from('app_settings')
    .select('candidate_result_sms_accepted, candidate_result_sms_reserve, candidate_result_sms_rejected').eq('id', 1).maybeSingle()
  const sent = (body?.templates ?? {}) as Partial<Record<ResultSmsKind, unknown>>
  const templates = {} as Record<ResultSmsKind, string>
  for (const k of RESULT_SMS_KINDS) {
    const t = typeof sent[k] === 'string' ? (sent[k] as string).trim() : ''
    templates[k] = t || (settings?.[COLUMN[k]] ?? '')
    if (templates[k].length < 10) throw createError({ statusCode: 400, statusMessage: 'اكتب نصّ كلّ رسالة.' })
    if (templates[k].length > MAX_INVITE_SMS_TEMPLATE) throw createError({ statusCode: 400, statusMessage: `الصيغة لا تتجاوز ${MAX_INVITE_SMS_TEMPLATE} حرف.` })
  }

  const { data, error } = await admin.from('candidates').select('id, full_name, gender, phone, status').in('id', ids)
  if (error) throw createError({ statusCode: 500, statusMessage: 'تعذّر تحميل المرشّحين.' })
  const ready = (data ?? []).filter(c => resultKind(c.status) && normalizeLocalPhone(c.phone))
  if (!ready.length) throw createError({ statusCode: 400, statusMessage: 'لا مرشّحَ مقرَّرٌ برقمٍ صالح بين المحدّدين.' })

  const messages = ready.map(c => renderResultSms(templates[resultKind(c.status)!], c))
  if (messages.some(m => smsSegments(m).segments > SMS_MAX_SEGMENTS)) {
    throw createError({ statusCode: 400, statusMessage: `الرسالة أطول من ${SMS_MAX_SEGMENTS} مقاطع — اختصرها.` })
  }
  if (body?.save === true) {
    const { error: saveError } = await admin.from('app_settings').update({
      candidate_result_sms_accepted: templates.accepted,
      candidate_result_sms_reserve: templates.reserve,
      candidate_result_sms_rejected: templates.rejected
    }).eq('id', 1)
    if (saveError) throw createError({ statusCode: 500, statusMessage: 'تعذّر حفظ الصيغ.' })
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
  if (okIds.length) await admin.from('candidates').update({ result_sms_at: new Date().toISOString() }).in('id', okIds)
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
      result: `نتيجة مقابلة — ${r?.ok ? 'وصلت' : `لم تصل${err ? `: ${err}` : ''}`}`.slice(0, 300),
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
