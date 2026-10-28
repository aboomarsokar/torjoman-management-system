import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'
import { MTC_CONCURRENCY, mtcSendOne } from '../../utils/mtcSms'
import { smsSegments } from '~/utils/sms'

/** أقصى أرقامٍ في النداء الواحد — ما زاد يبقى في الصفّ للدورة التالية (كلَّ خمس دقائق). */
const PER_CALL = 120

/**
 * يُرسل SMS الرسائل المجدولة (طلب المستخدم 2026-10-27). يناديه `private.dispatch_scheduled_messages` عبر `pg_net`
 * ومعه رمزٌ لمرّةٍ واحدة (`consume_cron_nonce`) — لا سرَّ مشتركاً، ورمزٌ مستهلَكٌ أو قديمٌ يُرفض. يحجز أسطرَ الصفّ
 * المعلّقة («sending») ويرسل لكلّ رقمٍ طلباً، ثم يكتب النتيجةَ في الصفّ وسطراً لكلّ رسالةٍ في `sms_log`.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ nonce?: unknown }>(event)
  const nonce = typeof body?.nonce === 'string' ? body.nonce : ''
  if (!/^[0-9a-f-]{36}$/i.test(nonce)) throw createError({ statusCode: 400, statusMessage: 'bad request' })
  const admin = serverSupabaseServiceRole<Database>(event)
  const { data: ok } = await admin.rpc('consume_cron_nonce', { p_nonce: nonce })
  if (!ok) throw createError({ statusCode: 403, statusMessage: 'forbidden' })

  const { data: pending } = await admin.from('scheduled_sms_queue')
    .select('id, schedule_id, body, name, phone, sent_by').eq('status', 'pending')
    .order('created_at').limit(PER_CALL)
  const rows = pending ?? []
  if (!rows.length) return { sent: 0, failed: 0 }
  await admin.from('scheduled_sms_queue').update({ status: 'sending' }).in('id', rows.map(r => r.id))

  const results = new Map<string, { ok: boolean, code: string }>()
  let next = 0
  async function worker() {
    while (next < rows.length) {
      const r = rows[next++]!
      const res = await mtcSendOne(r.phone, r.body)
      results.set(r.id, { ok: res.ok, code: res.code })
    }
  }
  await Promise.all(Array.from({ length: Math.min(MTC_CONCURRENCY, rows.length) }, worker))

  const now = new Date().toISOString()
  const okIds = rows.filter(r => results.get(r.id)?.ok).map(r => r.id)
  if (okIds.length) await admin.from('scheduled_sms_queue').update({ status: 'sent', code: '0', sent_at: now }).in('id', okIds)
  for (const r of rows.filter(x => !results.get(x.id)?.ok)) {
    await admin.from('scheduled_sms_queue').update({ status: 'failed', code: results.get(r.id)?.code ?? '?', sent_at: now }).eq('id', r.id)
  }

  // سطرٌ في سجلّ الرسائل لكلّ نصٍّ (رسالةٍ مجدولة) في هذه الدفعة
  const byBody = new Map<string, typeof rows>()
  for (const r of rows) byBody.set(r.body, [...(byBody.get(r.body) ?? []), r])
  for (const [text, group] of byBody) {
    const sent = group.filter(r => results.get(r.id)?.ok).length
    await admin.from('sms_log').insert({
      body: text.slice(0, 1000),
      recipients: group.map(r => ({ name: r.name, phone: r.phone, ok: results.get(r.id)?.ok ?? false, code: results.get(r.id)?.code ?? '?' })),
      recipients_count: group.length,
      segments: Math.min(15, Math.max(1, smsSegments(text).segments)),
      ok: sent === group.length,
      code: sent === group.length ? '0' : (group.map(r => results.get(r.id)).find(x => x && !x.ok)?.code ?? '?').slice(0, 20),
      result: `مجدولة · ${sent} من ${group.length}`,
      sent_by: group[0]!.sent_by
    })
  }
  return { sent: okIds.length, failed: rows.length - okIds.length }
})
