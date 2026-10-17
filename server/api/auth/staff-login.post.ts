/**
 * دخول الموظف بالرقم الوظيفي (منقول من الصحابة).
 * ⚠️ الترجمة في الخادم: الرقم ← الملف ← البريد الداخلي، ثم دخولٌ بعميلٍ بلا حفظ جلسة،
 * وتُعاد الرموز ليضعها المتصفّح. ⚠️ رسالةٌ واحدة لكل فشل كي لا يصير الباب عدّاداً للأرقام.
 */
import { createClient } from '@supabase/supabase-js'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'
import { isValidEmployeeNumber, normalizeDigits } from '~/constants/identity'
import { staffEmailFromNumber } from '~/constants/accounts'

const REJECTION = 'الرقم أو كلمة المرور غير صحيحة.'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ employeeNumber?: string, password?: string } | undefined>(event)
  const employeeNumber = normalizeDigits(body?.employeeNumber?.trim() ?? '')
  const password = body?.password ?? ''
  if (!isValidEmployeeNumber(employeeNumber) || !password) {
    throw createError({ statusCode: 401, statusMessage: REJECTION })
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const { data: profile } = await admin.from('profiles')
    .select('id, status').eq('employee_number', employeeNumber).maybeSingle()
  if (!profile || profile.status !== 'active') {
    throw createError({ statusCode: 401, statusMessage: REJECTION })
  }

  const config = useRuntimeConfig()
  const anon = createClient<Database>(config.public.supabase.url as string, config.public.supabase.key as string, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data, error } = await anon.auth.signInWithPassword({ email: staffEmailFromNumber(employeeNumber), password })
  if (error || !data.session) throw createError({ statusCode: 401, statusMessage: REJECTION })

  return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token }
})
