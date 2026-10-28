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
  'exams', 'examplan', 'programs',
  // ما يصل من الإدارة
  'messages', 'alerts', 'visits', 'quality-mine',
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
export const TEACHER_ONLINE_ONLY = ['my-booklets', 'student-requests'] as const

/** الشاشاتُ التي تعمل بلا إنترنت — غيرُها يُعتَم في القائمة ويُنبَّه عند ضغطه. */
export const OFFLINE_PATHS = [
  '/t/home', '/t', '/t/quran', '/t/students', '/t/students/view',
  // الدفعةُ الأولى (2026-10-27): شاشاتٌ تُقرأ من نسخة الجهاز (`useOfflineCopy`) — مشتركةٌ مع الأدوار الأخرى
  '/exam-plan', '/programs', '/visits', '/quality', '/alerts', '/messages', '/profile/me',
  // الدفعةُ الثانية (2026-10-28): كشفُ الحوافز — يُكتب على الجهاز ويُرفع حين يعود الاتصال، والإرسالُ متّصلاً
  '/incentives'
]
