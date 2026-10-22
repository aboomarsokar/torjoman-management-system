/**
 * بدءُ الدخول بالنيابة — جلسةٌ حقيقيّة بحساب موظفٍ بلا كلمته، قراءةً فقط حتى يُفتح وضعُ التعديل.
 * للمدير الإداري والمدير الفني وحدهما بقائمةٍ بيضاء (impersonationScope)، ولا نيابة داخل نيابة.
 * ⚠️ البريدُ لا يُقبل من الطلب — المعرّفُ وحده، والبريدُ من auth.users (openSessionFor).
 * ⚠️ جلسةٌ بلا صفٍّ يسمها نيابةً كاملةُ الكتابة — فإن تعذّر التسجيلُ أُغلقت ولم تُسلَّم.
 * الموظفُ يُشعَر بمُشغِّلٍ على impersonation_sessions (لا من هنا).
 */
import { requireCaller } from '../utils/caller'
import { requireWritableSession } from '../utils/impersonationGuard'
import { assertMayImpersonate, impersonationReturnTo, NESTED_IMPERSONATION_MESSAGE, parseImpersonateInput } from '../utils/impersonationScope'
import { openSessionFor } from '../utils/impersonationSession'
import { IMPERSONATION_WINDOW_MINUTES, STALE_SWEEP_HOURS } from '~/constants/impersonation'

export default defineEventHandler(async (event) => {
  const { caller, admin, accessToken: actorToken } = await requireCaller(event)
  if (caller.isImpersonating) throw createError({ statusCode: 403, statusMessage: NESTED_IMPERSONATION_MESSAGE })
  requireWritableSession(caller)

  const parsed = parseImpersonateInput(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const { profileId, from } = parsed.value

  // الكنس: الجلسةُ تُفتح هنا قبل أن يقبلها المتصفّح، فإن سقط العميلُ بقيت حيّةً بلا من يحملها.
  // كلُّ ما بدأ في المدى يُبطَل (المختومُ قد تبقى جلستُه حيّة)، والمفتوحُ يُختم «superseded».
  const since = new Date(Date.now() - STALE_SWEEP_HOURS * 3_600_000).toISOString()
  const { data: stale, error: staleError } = await admin.from('impersonation_sessions')
    .select('session_id, ended_at')
    .eq('actor_profile_id', caller.id)
    .gte('started_at', since)
  if (staleError) console.error('[impersonate] تعذّرت قراءةُ النيابات السابقة:', staleError)
  if (stale?.length) {
    const { error: endError } = await admin.rpc('end_impersonation_sessions', { p_session_ids: stale.map(s => s.session_id) })
    if (endError) console.error('[impersonate] تعذّر إبطالُ النيابات السابقة:', endError)
    const open = stale.filter(s => s.ended_at === null).map(s => s.session_id)
    if (open.length) {
      const { error: stampError } = await admin.from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString(), ended_reason: 'superseded' })
        .in('session_id', open)
      if (stampError) console.error('[impersonate] تعذّر ختمُ النيابات السابقة:', stampError)
    }
  }

  const [{ data: target }, { data: actor }] = await Promise.all([
    admin.from('profiles').select('id, full_name, role, status, gender').eq('id', profileId).maybeSingle(),
    admin.from('profiles').select('full_name').eq('id', caller.id).maybeSingle()
  ])
  if (!target) throw createError({ statusCode: 404, statusMessage: 'لا حسابَ بهذا المعرّف.' })
  const decision = assertMayImpersonate(
    { id: caller.id, role: caller.role, isImpersonating: caller.isImpersonating },
    { id: target.id, role: target.role, status: target.status, gender: target.gender }
  )
  if (!decision.ok) throw createError({ statusCode: decision.statusCode, statusMessage: decision.message })

  const opened = await openSessionFor(admin, target.id)
  const expiresAt = new Date(Date.now() + IMPERSONATION_WINDOW_MINUTES * 60_000).toISOString()

  const { error: insertError } = await admin.from('impersonation_sessions').insert({
    session_id: opened.sessionId,
    actor_profile_id: caller.id,
    target_profile_id: target.id,
    actor_name: actor?.full_name?.trim() || 'إدارة المشروع',
    target_name: target.full_name,
    actor_role: caller.role,
    expires_at: expiresAt,
    return_to: impersonationReturnTo(from, target.id)
  })
  if (insertError) {
    // لا صفَّ فلا تُبطلها end_impersonation_sessions — تُغلق برمزها محلّياً (global يُخرج الموظفَ من أجهزته).
    const { error: signOutError } = await admin.auth.admin.signOut(opened.accessToken, 'local')
    if (signOutError) console.error('[impersonate] تعذّر إغلاقُ الجلسة غير الموسومة:', signOutError)
    console.error('[impersonate] تعذّر تسجيلُ النيابة:', insertError)
    throw createError({ statusCode: 500, statusMessage: 'تعذّر بدء النيابة.' })
  }

  // جلسةُ الفاعل الأصليّة تُغلق محلّياً (أجهزتُه الأخرى لا تُمسّ): لا يحملها أحدٌ بعد أن يبدّل المتصفّحُ إلى النيابة،
  // فتبقى يتيمةً حيّة. والعودةُ لا تحتاجها — end/resume يفتح للفاعل جلسةً جديدة. فشلُ الإغلاق لا يُفشل البدء.
  const { error: actorSignOutError } = await admin.auth.admin.signOut(actorToken, 'local')
  if (actorSignOutError) console.error('[impersonate] تعذّر إغلاقُ جلسة الفاعل الأصليّة:', actorSignOutError)

  // رمزُ التحديث وحده — العميلُ يبدّل الجلسةَ بـrefreshSession ثم تحميلٌ كامل.
  return { refreshToken: opened.refreshToken, targetName: target.full_name, targetHome: '/dashboard', expiresAt }
})
