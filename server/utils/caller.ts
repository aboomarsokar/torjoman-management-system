/**
 * المستدعي في مسارات الخادم: هويّتُه من ادّعاءات الرمز، ودورُه من ملفّه، وصفُّ نيابته من معرّف الجلسة — معاً.
 * ⚠️ يُستدعى قبل أيّ استعمالٍ لعميل service_role: ذلك العميل يتخطّى RLS كلَّها.
 * ⚠️ الوسمُ على الجلسة لا على الحساب: `session_id` مطالبةٌ في الرمز لا قيمةٌ من الطلب (تُزوَّر فتنفي النيابة).
 * ⚠️ الادّعاءاتُ تُتحقَّق محلّياً (getClaims بمفاتيح JWKS) فتقبل رمزَ جلسةٍ حُذفت من auth.sessions حتى ينتهي
 * (إعادةُ تعيين كلمة المرور، الخروج، إنهاءُ النيابة، الكنس) — فالحياةُ تُسأل من GoTrue (getUser يردّ session_not_found).
 */
import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseServiceRole, serverSupabaseSession, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database.types'
import type { Role } from '~/constants/roles'

export interface ImpersonationRow {
  session_id: string
  actor_profile_id: string | null
  target_profile_id: string | null
  actor_name: string
  target_name: string
  actor_role: Role
  started_at: string
  expires_at: string
  ended_at: string | null
  write_until: string | null
  return_to: string | null
}

export interface Caller {
  id: string
  role: Role
  sessionId: string | null
  impersonation: ImpersonationRow | null
  isImpersonating: boolean
  /** من ليس نائباً يكتب دائماً، والنائبُ ما دامت نافذتُه (`write_until`) في المستقبل والنيابةُ قائمة. */
  canWrite: boolean
}

export interface SessionClaims {
  sub: string
  sessionId: string | null
  /** رمزُ الوصول نفسُه — لسؤال GoTrue عن حياة الجلسة ولإغلاقها؛ لا يُعاد إلى العميل ولا يُسجَّل. */
  accessToken: string
}

export const SESSION_ENDED_MESSAGE = 'انتهت الجلسة — ادخل من جديد.'
export const IMPERSONATION_ENDED_MESSAGE = 'انتهت مدّةُ النيابة — عُد إلى حسابك ثمّ ابدأ من جديد.'

export const IMPERSONATION_COLUMNS
  = 'session_id, actor_profile_id, target_profile_id, actor_name, target_name, actor_role, started_at, expires_at, ended_at, write_until, return_to'

type WriteWindow = Pick<ImpersonationRow, 'write_until'> & Partial<Pick<ImpersonationRow, 'ended_at' | 'expires_at'>>

/** النيابةُ قائمة: لم تُختم ولم تنتهِ مدّتُها. */
export function impersonationIsOpen(row: Partial<Pick<ImpersonationRow, 'ended_at' | 'expires_at'>>, now: number = Date.now()): boolean {
  if (row.ended_at != null) return false
  return row.expires_at == null || new Date(row.expires_at).getTime() > now
}

/** يطابق private.session_is_read_only: بلا صفٍّ ← يكتب؛ بصفٍّ ← ما دامت النيابةُ قائمةً وwrite_until بعد الآن. */
export function sessionCanWrite(row: WriteWindow | null, now: number = Date.now()): boolean {
  if (!row) return true
  if (!impersonationIsOpen(row, now)) return false
  return row.write_until !== null && new Date(row.write_until).getTime() > now
}

/** جوابُ GoTrue عن الرمز: حيٌّ إن لم يُرجع خطأً وكان المستخدمُ صاحبَ الادّعاء — وكلُّ ما سواه ميّت (يفشل مغلقاً). */
export function isLiveSessionResult(
  result: { data: { user: { id: string } | null } | null, error: unknown },
  sub: string
): boolean {
  return !result.error && result.data?.user?.id === sub
}

/**
 * ادّعاءاتُ الرمز (`sub` و`session_id`) ورمزُه، أو null — بلا رمي، وبلا سؤال الحياة (المنادي يسأل isSessionLive).
 */
export async function readSessionClaims(event: H3Event): Promise<SessionClaims | null> {
  try {
    const claims = await serverSupabaseUser(event)
    const sub = typeof claims?.sub === 'string' ? claims.sub : ''
    if (!sub) return null
    const session = await serverSupabaseSession(event)
    const accessToken = session?.access_token
    if (!accessToken) return null
    const sessionId = typeof claims?.session_id === 'string' && claims.session_id ? claims.session_id : null
    return { sub, sessionId, accessToken }
  } catch {
    return null
  }
}

/** هل ما زالت جلسةُ هذا الرمز في auth.sessions؟ — رحلةٌ واحدة إلى GoTrue. */
export async function isSessionLive(admin: SupabaseClient<Database>, claims: SessionClaims): Promise<boolean> {
  try {
    return isLiveSessionResult(await admin.auth.getUser(claims.accessToken), claims.sub)
  } catch {
    return false
  }
}

export async function requireCaller(event: H3Event): Promise<{ caller: Caller, admin: SupabaseClient<Database>, accessToken: string }> {
  const claims = await readSessionClaims(event)
  if (!claims) throw createError({ statusCode: 401, statusMessage: 'يلزم تسجيل الدخول.' })

  const admin = serverSupabaseServiceRole<Database>(event)
  // معاً لا بالتتابع: الثلاثةُ مستقلّة، وتتابعُها رحلاتٌ إضافيّة في كلّ طلبٍ خادميّ.
  const [live, profileResult, impersonationResult] = await Promise.all([
    isSessionLive(admin, claims),
    admin.from('profiles').select('id, role, status').eq('id', claims.sub).eq('status', 'active').maybeSingle(),
    claims.sessionId
      ? admin.from('impersonation_sessions').select(IMPERSONATION_COLUMNS).eq('session_id', claims.sessionId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])

  if (!live) throw createError({ statusCode: 401, statusMessage: SESSION_ENDED_MESSAGE })
  if (profileResult.error || impersonationResult.error) {
    console.error('[requireCaller] تعذّرت قراءة الحساب:', profileResult.error ?? impersonationResult.error)
    throw createError({ statusCode: 500, statusMessage: 'تعذّر التحقّق من الحساب.' })
  }
  const profile = profileResult.data
  if (!profile) throw createError({ statusCode: 403, statusMessage: 'هذا الحساب غير مُفعَّل.' })

  const impersonation = impersonationResult.data as ImpersonationRow | null
  // المنتهيةُ والمختومةُ سواء: يُردّ الطلب ولا يُرفع الوسم (رفعُه يقلب الجلسةَ كاملةَ الكتابة).
  if (impersonation && !impersonationIsOpen(impersonation)) {
    throw createError({ statusCode: 401, statusMessage: IMPERSONATION_ENDED_MESSAGE })
  }

  return {
    caller: {
      id: profile.id,
      role: profile.role,
      sessionId: claims.sessionId,
      impersonation,
      isImpersonating: impersonation !== null,
      canWrite: sessionCanWrite(impersonation)
    },
    admin,
    accessToken: claims.accessToken
  }
}
