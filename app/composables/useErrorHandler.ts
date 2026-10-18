/**
 * معالجة موحّدة للأخطاء — تعرض رسالة عربية واضحة عبر useToast (مبدأ CLAUDE.md).
 * تترجم أشهر أخطاء Supabase Auth إلى العربية، وإلا تعرض رسالة احتياطية.
 */

/** ترجمة رسائل أخطاء Supabase المعروفة إلى العربية. */
function translateError(message?: string): string | null {
  if (!message) return null
  const m = message.toLowerCase()
  if (m.includes('account_disabled')) return 'حسابك معطّل. تواصل مع الإدارة لإعادة تفعيله.'
  if (m.includes('invalid login credentials')) return 'الرقم أو كلمة المرور غير صحيحة.'
  if (m.includes('email not confirmed')) return 'الحساب بانتظار التفعيل — افتح رابط الدعوة في بريدك أولاً.'
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.'
  if (m.includes('network') || m.includes('fetch')) return 'تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت.'
  if (m.includes('user not found')) return 'لا يوجد حساب بهذا الرقم.'
  if (m.includes('password')) return 'كلمة المرور لا تحقّق المتطلّبات.'
  return null
}

export function useErrorHandler() {
  const toast = useToast()

  /** يعرض رسالة الخطأ كـ toast عربي، ويُرجع النصّ المعروض. */
  function handle(err: unknown, fallback = 'حدث خطأ غير متوقّع. حاول مجدداً.'): string {
    const raw = rawErrorText(err)
    // رسائل الدخول والخادم عربيةٌ أصلاً (LOGIN_ID_ERROR، رفض الدخول الموحّد) — تُعرض كما هي
    const message = translateError(raw) ?? (hasArabic(raw) ? raw : fallback)
    toast.add({ title: message, color: 'error', icon: 'i-lucide-circle-alert' })
    return message
  }

  return { handle, translateError }
}
