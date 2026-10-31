import { OFFLINE_DASHBOARD, OFFLINE_HOME, OFFLINE_QURAN, offlineStartFor } from '~/constants/offline'
// نوعٌ فقط (يُمحى عند البناء) فلا استيرادَ دائريّ
import type { OfflineOwnerRole } from '~/utils/offlineSnapshot'

/**
 * ترتيبُ قائمة المعلّم — مسطّحةٌ بلا مجموعاتٍ تُطوى (طلب المستخدم 2026-10-26: «ما بدي قوائم منسدلة… وأعد ترتيبهم»).
 * أُعيد 2026-10-27 («أعد ترتيب التبويبات جيداً») على مسار العمل: عملُ اليوم ← الاختبارات والبرامج ← ما يصل من الإدارة ←
 * الكشوفُ والطلبات (وفيها ما يحتاج اتصالاً فيجتمع آخرَ القائمة) ← الملفّ الشخصيّ. مفاتيحُ بنود القالب؛ وبندٌ لم يُذكر
 * هنا يأتي بعدها بترتيبه.
 */
export const TEACHER_NAV_ORDER = [
  // عملُ اليوم
  'dashboard-teacher', 'attendance-offline', 'quran-offline', 'students-teacher',
  // الاختباراتُ والبرامج
  'exams', 'examplan', 'programs', 'library',
  // ما يصل من الإدارة
  'messages', 'chat', 'alerts', 'visits', 'quality-mine',
  // الكشوفُ والطلبات
  'incentives', 'my-booklets', 'student-requests',
  'profile'
] as const

/** يرتّب البنودَ بالترتيب المعطى، وما لم يُذكر يأتي بعدها بترتيبه الأصليّ. */
export function orderByKeys<T extends { key: string }>(items: T[], order: readonly string[]): T[] {
  const rank = (k: string) => {
    const i = order.indexOf(k)
    return i === -1 ? order.length : i
  }
  return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item.key) - rank(b.item.key) || a.i - b.i).map(x => x.item)
}

/**
 * بنودُ المعلّم التي لا تُبنى للعمل بلا إنترنت (قرار المستخدم 2026-10-27): نادرةُ الاستعمال، وطلبُ الطالب يُفحص في
 * القاعدة فورَ إرساله — فعليها شارةٌ دائمةٌ في القائمة تقول إنها تحتاج اتصالاً.
 */
export const TEACHER_ONLINE_ONLY = ['my-booklets', 'student-requests', 'chat', 'library'] as const

/** الشاشاتُ التي تعمل بلا إنترنت — غيرُها يُعتَم في القائمة ويُنبَّه عند ضغطه. */
export const OFFLINE_PATHS = [
  '/t/home', '/t', '/t/quran', '/t/students', '/t/students/view',
  // الدفعةُ الأولى (2026-10-27): شاشاتٌ تُقرأ من نسخة الجهاز (`useOfflineCopy`) — مشتركةٌ مع الأدوار الأخرى
  '/exam-plan', '/programs', '/visits', '/quality', '/alerts', '/messages', '/profile/me',
  // الدفعةُ الثانية (2026-10-28): كشفُ الحوافز — يُكتب على الجهاز ويُرفع حين يعود الاتصال، والإرسالُ متّصلاً
  '/incentives'
]

/** شاشاتُ المشرف الميدانيّ بلا إنترنت (2026-10-29) — زياراتُه وملفُّه الشخصيّ. */
export const SUPERVISOR_OFFLINE_PATHS = ['/visits', '/profile/me']

/** شاشاتُ المختبِر بلا إنترنت (2026-10-29) — اختباراتُه وملفُّه الشخصيّ. */
export const EXAMINER_OFFLINE_PATHS = ['/exams', '/profile/me']

/** الشاشاتُ التي تعمل بلا إنترنت لدورِ صاحب الجهاز — المعلّمُ (أو من لا دورَ محفوظاً له) `OFFLINE_PATHS` بلا تغيير. */
export function offlinePathsFor(role: OfflineOwnerRole | null): readonly string[] {
  if (role === 'field_supervisor') return SUPERVISOR_OFFLINE_PATHS
  if (role === 'examiner') return EXAMINER_OFFLINE_PATHS
  return OFFLINE_PATHS
}

/**
 * وجهةُ التحويل بلا اتصال، أو null إن كان المسارُ مسموحاً لهذا الدور. للمعلّم تحويلاتُه كما كانت في الوسيط
 * (الإنجازُ والحضورُ والطلابُ ثمّ اللوحة)، وللمشرف والمختبِر شاشةُ إقلاعهما.
 */
export function offlineRedirect(path: string, role: OfflineOwnerRole | null): string | null {
  if (offlinePathsFor(role).includes(path)) return null
  if (role === 'field_supervisor' || role === 'examiner') return offlineStartFor(role)
  if (path === '/reports') return OFFLINE_QURAN
  if (path === '/attendance') return OFFLINE_HOME
  if (path.startsWith('/students')) return '/t/students'
  return OFFLINE_DASHBOARD
}
