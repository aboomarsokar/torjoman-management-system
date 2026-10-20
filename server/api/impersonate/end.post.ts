/**
 * إنهاءُ النيابة — يختم الصفَّ ويُبطل جلسةَ النيابة وحدها (لا جلساتِ الموظف)، ويُصدر للفاعل جلسةً جديدة يعود بها.
 * ⚠️ بلا requireCaller: يرمي 401 على النيابة المنتهية — فيُقرأ معرّفُ الجلسة من الادّعاءات، ويُسأل عن الحياة هنا.
 * ⚠️ الخروجُ (resume=false) يعمل على أيّ صفٍّ ولو ماتت جلستُه: ختمٌ وإبطالٌ لا يمنحان شيئاً.
 * ⚠️ العودةُ لا تُصدر جلسةَ مديرٍ إلا من نيابةٍ قائمة (لم تُختم) وجلسةٍ حيّة في auth.sessions — رمزٌ مُبطَلٌ
 * أو نيابةٌ مختومة ← 401، وإلا صار كلُّ رمز نيابةٍ قديمٍ مفتاحاً لحساب المدير حتى ينتهي.
 * ⚠️ الصفُّ يُختم ولا يُحذف: هو السجلّ، وحذفُه يقلب جلسةً حيّةً كاملةَ الكتابة.
 * ⚠️ جلسةُ العودة تُفتح أوّلاً ثم يُبطَل الذهاب — لو أُبطل أوّلاً وتعذّرت العودةُ بقي بلا جلسةٍ أصلاً.
 * باب خروجٍ مستثنى من requireWritableSession (impersonationGuardCoverage.test.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { isSessionLive, readSessionClaims, SESSION_ENDED_MESSAGE } from '../../utils/caller'
import { parseEndInput } from '../../utils/impersonationScope'
import { openSessionFor } from '../../utils/impersonationSession'
import { isImpersonatorRole } from '~/constants/impersonation'

type EndReason = 'manual' | 'signed_out' | 'actor_inactive'

/** يختم الصفَّ إن لم يُختم ثم يُبطل جلستَه — والخطأ يُسجَّل ولا يحبس المستخدم. */
async function closeSession(admin: SupabaseClient<Database>, sessionId: string, alreadyEnded: boolean, reason: EndReason) {
  if (!alreadyEnded) {
    const { error } = await admin.from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString(), ended_reason: reason })
      .eq('session_id', sessionId)
    if (error) console.error('[impersonate/end] تعذّر ختمُ النيابة:', error)
  }
  const { error } = await admin.rpc('end_impersonation_sessions', { p_session_ids: [sessionId] })
  if (error) console.error('[impersonate/end] تعذّر إبطالُ جلسة النيابة:', error)
}

export default defineEventHandler(async (event) => {
  const claims = await readSessionClaims(event)
  if (!claims) throw createError({ statusCode: 401, statusMessage: 'يلزم تسجيل الدخول.' })
  const parsed = parseEndInput(await readBody(event).catch(() => undefined))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })

  const admin = serverSupabaseServiceRole<Database>(event)
  const [{ data: row }, live] = await Promise.all([
    claims.sessionId
      ? admin.from('impersonation_sessions')
          .select('session_id, actor_profile_id, ended_at, return_to')
          .eq('session_id', claims.sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isSessionLive(admin, claims)
  ])
  if (!row) throw createError({ statusCode: 400, statusMessage: 'هذه الجلسةُ ليست نيابة.' })
  const ended = row.ended_at !== null

  if (!parsed.value.resume) {
    await closeSession(admin, row.session_id, ended, 'signed_out')
    return { ok: true }
  }

  // لا عودةَ من نيابةٍ مختومة أو جلسةٍ مُبطَلة — يُتمّ الإغلاقَ ويُرسل إلى الدخول.
  if (ended || !live) {
    await closeSession(admin, row.session_id, ended, 'manual')
    throw createError({ statusCode: 401, statusMessage: SESSION_ENDED_MESSAGE })
  }

  // الفاعلُ يُقرأ الآن لا من الصفّ: عُطِّل أو تغيّر دورُه أو حُذف ← لا جلسةَ عودة.
  const { data: actor } = row.actor_profile_id
    ? await admin.from('profiles').select('id, role, status').eq('id', row.actor_profile_id).maybeSingle()
    : { data: null }
  if (!actor || actor.status !== 'active' || !isImpersonatorRole(actor.role)) {
    await closeSession(admin, row.session_id, ended, 'actor_inactive')
    throw createError({ statusCode: 409, statusMessage: 'انتهت النيابة — سجّل دخولك من جديد.' })
  }

  const back = await openSessionFor(admin, actor.id)
  await closeSession(admin, row.session_id, ended, 'manual')
  return { refreshToken: back.refreshToken, returnTo: row.return_to ?? '/users' }
})
