/**
 * معالجة موحّدة للأخطاء — تعرض رسالة عربية واضحة عبر useToast (مبدأ CLAUDE.md).
 * تترجم أشهر أخطاء Supabase Auth إلى العربية، وإلا تعرض رسالة احتياطية.
 */
import type { ImpersonationStatus } from '~/constants/impersonation'
import { IMPERSONATION_STATE_KEY, readOnlyRefusal } from '~/utils/impersonation'

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
  // رفضُ RLS بالإنجليزية (من المستودع خاصّةً) خارج النيابة: الصلاحيةُ أو جلسةٌ انتهت أو أُبطلت
  if (m.includes('row-level security')) return 'لا صلاحية لهذه العملية — إن كانت من صلاحيتك فقد تكون جلستك انتهت: سجّل الخروج ثم ادخل من جديد.'
  // قيودُ `*_from_project_start` (الهجرة 20261024143005)
  if (m.includes('_from_project_start')) return 'لا يُقبل تاريخٌ قبل بداية المشروع (1/10/2026).'
  return null
}

export function useErrorHandler() {
  const toast = useToast()
  // حالةُ النيابة مباشرةً من useState (لا useImpersonation: المعالجُ يُستدعى في كلّ مكوّن)
  const impersonation = useState<ImpersonationStatus | null>(IMPERSONATION_STATE_KEY, () => null)

  /** يعرض رسالة الخطأ كـ toast عربي، ويُرجع النصّ المعروض. */
  function handle(err: unknown, fallback = 'حدث خطأ غير متوقّع. حاول مجدداً.'): string {
    const raw = rawErrorText(err)
    // رفضٌ عامّ (42501/403 بالإنجليزية — المستودعُ خاصّةً) في نيابة القراءة ← «أنت في وضع القراءة»؛
    // ورسالةُ حارس القاعدة العربية تمرّ كما هي
    const readOnly = hasArabic(raw) ? null : readOnlyRefusal(err, impersonation.value, Date.now())
    // رسائل الدخول والخادم عربيةٌ أصلاً (LOGIN_ID_ERROR، رفض الدخول الموحّد) — تُعرض كما هي
    const message = readOnly ?? translateError(raw) ?? (hasArabic(raw) ? raw : fallback)
    toast.add({ title: message, color: 'error', icon: 'i-lucide-circle-alert' })
    return message
  }

  return { handle, translateError }
}
