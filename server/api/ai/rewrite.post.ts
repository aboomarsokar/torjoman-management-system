import { requireCaller } from '../../utils/caller'
import { REWRITE_MAX_INPUT, rewriteMessage, type RewriteAudience, type RewriteKind } from '../../utils/aiRewrite'

/** من يكتب رسائل الإدارة: SMS ورسائلُ الكادر للمدير الإداريّ والمدير الفنيّ والمديرة الإدارية. */
const ALLOWED: Record<RewriteKind, readonly string[]> = {
  sms: ['admin_manager', 'technical_manager', 'women_admin'],
  announcement: ['admin_manager', 'technical_manager', 'women_admin']
}
const AUDIENCES: readonly RewriteAudience[] = ['male', 'female', 'mixed']

/** يعيد صياغة مسوّدة رسالةٍ بالذكاء الاصطناعي ويُرجع الاقتراح — لا يكتب شيئاً ولا يرسل. */
export default defineEventHandler(async (event) => {
  const { caller } = await requireCaller(event)
  const body = await readBody<{ kind?: string, audience?: string, title?: string, body?: string }>(event)
  const kind = body?.kind === 'sms' || body?.kind === 'announcement' ? body.kind : null
  if (!kind) throw createError({ statusCode: 400, statusMessage: 'نوع الرسالة غير معروف.' })
  if (!ALLOWED[kind].includes(caller.role)) {
    throw createError({ statusCode: 403, statusMessage: 'إعادة الصياغة لمن يكتب هذه الرسائل.' })
  }
  const audience = AUDIENCES.find(a => a === body?.audience) ?? 'mixed'
  const title = String(body?.title ?? '').trim()
  const text = String(body?.body ?? '').trim()
  if (!title && !text) throw createError({ statusCode: 400, statusMessage: 'اكتب الرسالة أوّلاً ثمّ أعد صياغتها.' })
  if (title.length + text.length > REWRITE_MAX_INPUT) {
    throw createError({ statusCode: 400, statusMessage: `النصّ أطول من ${REWRITE_MAX_INPUT} حرف.` })
  }
  return rewriteMessage({ kind, audience, title, body: text })
})
