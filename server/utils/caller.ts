/**
 * المستدعي في مسارات الخادم: هويّتُه من ادّعاءات الرمز، ودورُه من ملفّه، وصفُّ نيابته من معرّف الجلسة — معاً.
 * ⚠️ يُستدعى قبل أيّ استعمالٍ لعميل service_role: ذلك العميل يتخطّى RLS كلَّها.
 * ⚠️ الوسمُ على الجلسة لا على الحساب: `session_id` مطالبةٌ في الرمز لا قيمةٌ من الطلب (تُزوَّر فتنفي النيابة).
 */
import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
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
  /** من ليس نائباً يكتب دائماً، والنائبُ ما دامت نافذتُه (`write_until`) في المستقبل. */
  canWrite: boolean
}

export const IMPERSONATION_COLUMNS
  = 'session_id, actor_profile_id, target_profile_id, actor_name, target_name, actor_role, started_at, expires_at, ended_at, write_until, return_to'

/** يطابق private.session_is_read_only: بلا صفٍّ ← يكتب؛ بصفٍّ ← ما دام write_until بعد الآن. */
export function sessionCanWrite(row: Pick<ImpersonationRow, 'write_until'> | null, now: number = Date.now()): boolean {
  if (!row) return true
  return row.write_until !== null && new Date(row.write_until).getTime() > now
}

/**
 * ادّعاءاتُ الرمز (`sub` و`session_id`) أو null — بلا رمي: رمزٌ أُبطلت جلستُه قد يُرمى عند التحقّق،
 * والمنادي يقرّر (401 أو «ليست نيابة»).
 */
export async function readSessionClaims(event: H3Event): Promise<{ sub: string, sessionId: string | null } | null> {
  let claims: Awaited<ReturnType<typeof serverSupabaseUser>>
  try {
    claims = await serverSupabaseUser(event)
  } catch {
    return null
  }
  const sub = typeof claims?.sub === 'string' ? claims.sub : ''
  if (!sub) return null
  const sessionId = typeof claims?.session_id === 'string' && claims.session_id ? claims.session_id : null
  return { sub, sessionId }
}

export async function requireCaller(event: H3Event): Promise<{ caller: Caller, admin: SupabaseClient<Database> }> {
  const claims = await readSessionClaims(event)
  if (!claims) throw createError({ statusCode: 401, statusMessage: 'يلزم تسجيل الدخول.' })

  const admin = serverSupabaseServiceRole<Database>(event)
  // معاً لا بالتتابع: الاستعلامان مستقلّان، وتتابعُهما رحلةٌ إضافيّة في كلّ طلبٍ لميزةٍ تُستعمل دقائقَ في الشهر.
  const [profileResult, impersonationResult] = await Promise.all([
    admin.from('profiles').select('id, role, status').eq('id', claims.sub).eq('status', 'active').maybeSingle(),
    claims.sessionId
      ? admin.from('impersonation_sessions').select(IMPERSONATION_COLUMNS).eq('session_id', claims.sessionId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])

  if (profileResult.error || impersonationResult.error) {
    console.error('[requireCaller] تعذّرت قراءة الحساب:', profileResult.error ?? impersonationResult.error)
    throw createError({ statusCode: 500, statusMessage: 'تعذّر التحقّق من الحساب.' })
  }
  const profile = profileResult.data
  if (!profile) throw createError({ statusCode: 403, statusMessage: 'هذا الحساب غير مُفعَّل.' })

  const impersonation = impersonationResult.data as ImpersonationRow | null
  // الانتهاءُ يُنفَّذ هنا لا بمؤقّتٍ في المتصفّح، ولا يُرفع الوسم (يقلب الجلسةَ كاملةَ الكتابة) — يُردّ الطلب.
  if (impersonation && new Date(impersonation.expires_at).getTime() <= Date.now()) {
    throw createError({ statusCode: 401, statusMessage: 'انتهت مدّةُ النيابة — عُد إلى حسابك ثمّ ابدأ من جديد.' })
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
    admin
  }
}
