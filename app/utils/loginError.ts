/**
 * رسالة فشل الدخول — واحدةٌ لكل رفض (رقم مجهول أو كلمة خاطئة) كي لا تصير الشاشة عدّاداً للأرقام،
 * إلا تجاوز حدّ المحاولات (429 / over_request_rate_limit) فله رسالته: الانتظار هنا هو الحلّ لا إعادة الكتابة.
 */
import { LOGIN_RATE_LIMITED, LOGIN_REJECTION } from '~/constants/auth'

export function loginErrorMessage(error: { status?: number, code?: string } | null | undefined): string {
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return LOGIN_RATE_LIMITED
  return LOGIN_REJECTION
}
