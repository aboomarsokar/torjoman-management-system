/**
 * فتحُ نافذة الكتابة في النيابة وإغلاقُها — عشرُ دقائق لا تتجاوز انتهاءَ الجلسة، للمدير الإداري والمدير الفني.
 * ⚠️ بلا requireCaller ولا دورِ المنادي: المنادي في النيابة هو الهدف — والحارسُ دورُ الفاعل في ملفّه الآن
 * (لا المصوَّر في الصفّ: فاعلٌ عُطِّل في أثناء النيابة لا يفتح).
 * الفتحُ يُشعر الموظفَ بمُشغِّل القاعدة، والفتحُ والإغلاقُ يُسجَّلان في impersonation_writes.
 * باب الكتابة مستثنى من requireWritableSession (impersonationGuardCoverage.test.ts) — لا نافذةَ قبل الفتح.
 */
import type { Database } from '~/types/database.types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { isSessionLive, readSessionClaims, SESSION_ENDED_MESSAGE } from '../../utils/caller'
import { parseWriteModeInput } from '../../utils/impersonationScope'
import { isImpersonatorRole, mayImpersonateRole, WRITE_WINDOW_MINUTES } from '~/constants/impersonation'

export default defineEventHandler(async (event): Promise<{ writeUntil: string | null }> => {
  const claims = await readSessionClaims(event)
  if (!claims) throw createError({ statusCode: 401, statusMessage: 'يلزم تسجيل الدخول.' })
  const parsed = parseWriteModeInput(await readBody(event).catch(() => undefined))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const { on } = parsed.value

  const admin = serverSupabaseServiceRole<Database>(event)
  const [{ data: row }, live] = await Promise.all([
    claims.sessionId
      ? admin.from('impersonation_sessions')
          .select('session_id, actor_profile_id, target_profile_id, ended_at, expires_at')
          .eq('session_id', claims.sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    on ? isSessionLive(admin, claims) : Promise.resolve(true)
  ])
  const now = Date.now()
  const expiresAt = row ? new Date(row.expires_at).getTime() : 0
  if (!row || row.ended_at !== null || expiresAt <= now) {
    throw createError({ statusCode: 400, statusMessage: 'هذه الجلسةُ ليست نيابةً قائمة.' })
  }

  // الفتحُ وحده يُحرس: الإغلاقُ يُنقص الصلاحية، ورفضُه يُبقي النافذةَ مفتوحة.
  if (on) {
    if (!live) throw createError({ statusCode: 401, statusMessage: SESSION_ENDED_MESSAGE })
    // الفاعلُ والهدفُ يُقرآن الآن: فاعلٌ عُطِّل، أو هدفٌ تغيّر دورُه إلى ما لا يُناب عنه، لا يُفتح له.
    const [{ data: actor }, { data: target }] = await Promise.all([
      row.actor_profile_id
        ? admin.from('profiles').select('role, status').eq('id', row.actor_profile_id).maybeSingle()
        : Promise.resolve({ data: null }),
      row.target_profile_id
        ? admin.from('profiles').select('role, status').eq('id', row.target_profile_id).maybeSingle()
        : Promise.resolve({ data: null })
    ])
    if (!actor || actor.status !== 'active' || !isImpersonatorRole(actor.role)) {
      throw createError({ statusCode: 403, statusMessage: 'وضعُ التعديل للمدير الإداري والمدير الفني وحدهما.' })
    }
    if (!target || target.status !== 'active' || !mayImpersonateRole(actor.role, target.role)) {
      throw createError({ statusCode: 403, statusMessage: 'لم يعد لك الدخولُ بحساب هذا الموظف — أنهِ النيابة.' })
    }
  }

  const writeUntil = new Date(Math.min(on ? now + WRITE_WINDOW_MINUTES * 60_000 : now, expiresAt)).toISOString()
  const { error } = await admin.from('impersonation_sessions')
    .update({ write_until: writeUntil })
    .eq('session_id', row.session_id)
  if (error) {
    console.error('[impersonate/write-mode] تعذّر تبديلُ النافذة:', error)
    throw createError({ statusCode: 500, statusMessage: 'تعذّر تبديلُ وضع التعديل.' })
  }

  const { error: logError } = await admin.from('impersonation_writes').insert({
    session_id: row.session_id,
    actor_profile_id: row.actor_profile_id,
    target_profile_id: row.target_profile_id,
    op: on ? 'write_mode_on' : 'write_mode_off',
    route: '/api/impersonate/write-mode'
  })
  if (logError) console.error('[impersonate/write-mode] تعذّر تسجيلُ التبديل:', logError)

  return { writeUntil: on ? writeUntil : null }
})
