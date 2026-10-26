/**
 * ترتيبُ قائمة المعلّم — مسطّحةٌ بلا مجموعاتٍ تُطوى، بترتيب الاستعمال اليوميّ (طلب المستخدم 2026-10-26:
 * «ما بدي قوائم منسدلة… وأعد ترتيبهم»). مفاتيحُ بنود القالب؛ وبندٌ لم يُذكر هنا يأتي بعدها بترتيبه.
 */
export const TEACHER_NAV_ORDER = [
  'dashboard', 'attendance-offline', 'reports', 'students', 'exams', 'examplan', 'programs-progress', 'programs-units',
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

/** الشاشاتُ التي تعمل بلا إنترنت — غيرُها يُعتَم في القائمة ويُنبَّه عند ضغطه. */
export const OFFLINE_PATHS = ['/t']
