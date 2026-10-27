import { requireSmsSender } from '../../utils/smsSender'
import { mtcBalance } from '../../utils/mtcSms'

/** رصيدُ حساب الرسائل عند MTC (المدير الإداري والمدير الفنيّ والمديرة الإدارية) — قراءةٌ لا كتابة. */
export default defineEventHandler(async (event) => {
  await requireSmsSender(event)
  return mtcBalance()
})
