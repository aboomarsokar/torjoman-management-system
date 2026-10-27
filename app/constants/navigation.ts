/**
 * ترتيبُ قائمة المعلّم — مسطّحةٌ بلا مجموعاتٍ تُطوى، بترتيب الاستعمال اليوميّ (طلب المستخدم 2026-10-26:
 * «ما بدي قوائم منسدلة… وأعد ترتيبهم»). مفاتيحُ بنود القالب؛ وبندٌ لم يُذكر هنا يأتي بعدها بترتيبه.
 */
export const TEACHER_NAV_ORDER = [
  'dashboard-teacher', 'attendance-offline', 'quran-offline', 'students-teacher', 'student-requests', 'exams', 'examplan', 'programs',
  'incentives', 'my-booklets', 'messages', 'visits', 'quality-mine', 'alerts', 'profile'
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
export const OFFLINE_PATHS = ['/t/home', '/t', '/t/quran', '/t/students', '/t/students/view']
