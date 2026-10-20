/**
 * يفتح جلسةَ Supabase حقيقيّةً لحسابٍ بمعرّفه (للهدف عند البدء، وللفاعل عند العودة) بلا كلمة مروره.
 * ⚠️ البريدُ من auth.users بالمعرّف لا من الطلب: `generateLink` من نوع magiclink يُنشئ حساباً لبريدٍ مجهول.
 * ⚠️ لا يُرسَل بريد (generateLink يُرجع الرمزَ فقط، والنطاقان الداخليان لا يستقبلان أصلاً).
 * ⚠️ الرمزُ يُستهلَك هنا بعميلٍ منفصلٍ بلا حفظ جلسة: عميلُ الطلب يبدّل جلسةَ المدير، والاستهلاكُ في المتصفّح
 * يفتح جلسةً لا يعرف الخادمُ معرّفَها فلا يسمها نيابةً — أي كاملةَ الكتابة.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { sessionIdFromAccessToken } from './impersonationScope'

export async function openSessionFor(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<{ accessToken: string, refreshToken: string, sessionId: string }> {
  const { data: found, error: userError } = await admin.auth.admin.getUserById(userId)
  const email = found?.user?.email
  if (userError || !email) {
    console.error('[openSessionFor] تعذّرت قراءةُ الحساب:', userError)
    throw createError({ statusCode: 500, statusMessage: 'تعذّرت قراءةُ الحساب.' })
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) {
    console.error('[openSessionFor] تعذّر توليدُ الرمز:', linkError)
    throw createError({ statusCode: 500, statusMessage: 'تعذّر فتحُ الجلسة.' })
  }

  const config = useRuntimeConfig()
  const probe = createClient<Database>(
    config.public.supabase.url as string,
    config.public.supabase.key as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: opened, error: otpError } = await probe.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  const session = opened?.session
  if (otpError || !session) {
    console.error('[openSessionFor] تعذّر فتحُ الجلسة:', otpError)
    const statusCode = otpError?.status === 429 ? 429 : 500
    throw createError({
      statusCode,
      statusMessage: statusCode === 429 ? 'محاولات كثيرة، انتظر دقيقة ثم حاول.' : 'تعذّر فتحُ الجلسة.'
    })
  }

  const sessionId = sessionIdFromAccessToken(session.access_token)
  if (!sessionId) {
    // رمزٌ بلا معرّف جلسةٍ لا يُوسَم فلا يُسلَّم — ويُغلق محلّياً وحده (global يُخرج صاحبَ الحساب من أجهزته).
    await admin.auth.admin.signOut(session.access_token, 'local')
    throw createError({ statusCode: 500, statusMessage: 'رمزٌ بلا معرّف جلسة — لا تُفتح النيابة.' })
  }
  return { accessToken: session.access_token, refreshToken: session.refresh_token, sessionId }
}
