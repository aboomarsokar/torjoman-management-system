/**
 * هل جلستي الحاليّةُ نيابة؟ — تُسأل من الجلسة لا تُحفظ في ذاكرة المتصفّح (تحديثُ الصفحة يمحوها والنيابةُ قائمة).
 * ⚠️ بلا requireCaller ولا دور: المنادي في النيابة هو الهدف، وحارسُ دورٍ هنا يُخفي الشريطَ عمّن يحتاجه.
 * ⚠️ قراءةٌ خالصة — لا كنسَ هنا: إبطالُ الجلسة قبل `end` يُسقط ادّعاءاتها فيتعذّر الرجوع.
 * بلا جلسةٍ أو بلا صفّ ← null (204).
 */
import type { Database } from '~/types/database.types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { readSessionClaims } from '../../utils/caller'
import type { ImpersonationStatus, ImpersonatorRole } from '~/constants/impersonation'

// النوعُ في الثوابت (مصدرٌ واحد للخادم والواجهة) — ويُعاد تصديرُه هنا لمن استورده من المسار.
export type { ImpersonationStatus }

export default defineEventHandler(async (event): Promise<ImpersonationStatus | null> => {
  const claims = await readSessionClaims(event)
  if (!claims?.sessionId) return null

  const admin = serverSupabaseServiceRole<Database>(event)
  const { data } = await admin.from('impersonation_sessions')
    .select('target_name, actor_name, actor_role, expires_at, write_until, ended_at')
    .eq('session_id', claims.sessionId)
    .maybeSingle()
  if (!data) return null

  return {
    targetName: data.target_name,
    actorName: data.actor_name,
    // القيدُ في القاعدة يحصر actor_role في الفاعلَين.
    actorRole: data.actor_role as ImpersonatorRole,
    expiresAt: data.expires_at,
    writeUntil: data.write_until,
    ended: data.ended_at !== null
  }
})
