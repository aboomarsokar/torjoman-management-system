import { requireAdminManager } from '../../utils/supabaseAdmin'

/**
 * فحصٌ مؤقّت لإعداد حساب الرسائل على الخادم (المدير الإداري فقط — 2026-10-27): يصف القيمَ ولا يكشفها —
 * الطولُ ووجودُ علاماتٍ قد تُفسدها (اقتباس، مسافة طرفية، شرطةٌ مائلة، $، #). يُحذف بعد حلّ المشكلة.
 */
export default defineEventHandler(async (event) => {
  await requireAdminManager(event)
  const c = useRuntimeConfig()
  const describe = (v: unknown) => {
    const s = String(v ?? '')
    return {
      length: s.length,
      quoted: /^["']|["']$/.test(s),
      edgeSpace: /^\s|\s$/.test(s),
      backslash: s.includes('\\'),
      dollar: s.includes('$'),
      hash: s.includes('#')
    }
  }
  return {
    username: describe(c.mtcSmsUsername),
    password: describe(c.mtcSmsPassword),
    sender: describe(c.mtcSmsSender)
  }
})
