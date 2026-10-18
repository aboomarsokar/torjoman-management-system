/**
 * ثوابت المصادقة.
 * لا كلمة مرور افتراضية في الشيفرة: كلمة كل حسابٍ جديد أو مُعاد تعيينه مؤقّتةٌ يولّدها الخادم
 * (server/utils/tempPassword.ts) وتُعرض مرّةً واحدة، وصاحبها يغيّرها إلزاماً عند أول دخول.
 */

/** الحدّ الأدنى لطول كلمة المرور عند تغييرها. */
export const PASSWORD_MIN_LENGTH = 8

/** شاشة «غيّر كلمة مرورك أولاً» — الوحيدة المتاحة ما دام must_change_password قائماً (مع الخروج). */
export const CHANGE_PASSWORD_PATH = '/change-password'

/** رسالة رفض الدخول الموحّدة — لا تفرّق بين رقم خاطئ وكلمة مرور خاطئة. */
export const LOGIN_REJECTION = 'الرقم أو كلمة المرور غير صحيحة.'

/** تجاوز حدّ محاولات الدخول في Supabase Auth (429 / over_request_rate_limit). */
export const LOGIN_RATE_LIMITED = 'محاولات كثيرة، انتظر دقيقة ثم حاول.'
