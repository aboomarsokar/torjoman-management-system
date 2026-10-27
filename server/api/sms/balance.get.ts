import { requireAdminManager } from '../../utils/supabaseAdmin'
import { mtcBalance } from '../../utils/mtcSms'

/** رصيدُ حساب الرسائل عند MTC (المدير الإداري فقط) — قراءةٌ لا كتابة. */
export default defineEventHandler(async (event) => {
  await requireAdminManager(event)
  return mtcBalance()
})
