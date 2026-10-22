/**
 * أرقامُ رأس الشاشات (طلب المستخدم 2026-10-21: «في كلّ تبويب أرقامُ إحصائياتٍ عامّة بحسب عنوانه»).
 * كلُّ دالّةٍ تأخذ صفوفَ الشاشة المحمّلةَ أصلاً (فتتبع نطاقَ RLS وتصفيتَها، بلا طلباتٍ جديدة) وتُرجع
 * بنودَ `UiStatStrip` جاهزة. مختبَرةٌ في pageStats.test.ts.
 */
import type { StatItem } from '~/components/ui/StatStrip.vue'
import { formatAmount, isolateLtr } from '~/utils/transport'

const round1 = (n: number) => Math.round(n * 10) / 10
/** شهرُ تاريخٍ `YYYY-MM-DD` = شهرُ اليوم؟ */
const sameMonth = (iso: string | null | undefined, today: string) => !!iso && iso.slice(0, 7) === today.slice(0, 7)

/** الطلاب: النشطون، وغيرُ النشطين (منقطع/متخرّج/منقول)، والملتحقون هذا الشهر، ومتوسّطُ المحفوظ عند الالتحاق. */
export function studentStats(rows: { status: string, enrollment_date: string | null, quran_parts: number | null }[], today: string): StatItem[] {
  const active = rows.filter(s => s.status === 'active')
  const parts = active.map(s => s.quran_parts).filter((p): p is number => p !== null)
  return [
    { key: 'active', icon: 'i-lucide-graduation-cap', value: active.length, label: 'طالباً نشطاً' },
    { key: 'inactive', icon: 'i-lucide-user-minus', tone: 'neutral', value: rows.length - active.length, label: 'غيرُ نشط (منقطع/متخرّج/منقول)' },
    { key: 'new', icon: 'i-lucide-user-plus', tone: 'green', value: active.filter(s => sameMonth(s.enrollment_date, today)).length, label: 'التحق هذا الشهر' },
    { key: 'parts', icon: 'i-lucide-book-open-check', value: parts.length ? String(round1(parts.reduce((a, b) => a + b, 0) / parts.length)) : '—', label: 'جزءاً محفوظاً متوسّطاً عند الالتحاق' }
  ]
}

/** المواصلات: رحلاتُ الشهر، ومجموعُها، والمسدَّدُ منه، وغيرُ المسدَّد. */
export function transportStats(trips: { amount: number | string, paid: boolean }[]): StatItem[] {
  const sum = (list: typeof trips) => Math.round(list.reduce((s, t) => s + Number(t.amount), 0) * 100) / 100
  const money = (n: number) => isolateLtr(formatAmount(n))
  const unpaid = trips.filter(t => !t.paid)
  return [
    { key: 'trips', icon: 'i-lucide-bus', value: trips.length, label: 'رحلة في الشهر' },
    { key: 'total', icon: 'i-lucide-wallet', tone: 'neutral', value: money(sum(trips)), label: 'المجموع' },
    { key: 'paid', icon: 'i-lucide-circle-check', tone: 'green', value: money(sum(trips.filter(t => t.paid))), label: 'المسدَّد' },
    { key: 'unpaid', icon: 'i-lucide-clock', tone: unpaid.length ? 'err' : 'neutral', value: money(sum(unpaid)), label: 'غيرُ المسدَّد' }
  ]
}

/** التنبيهات: كلُّها، والجديدةُ بلا إقرار، والمُقَرُّ بها، والإنذاراتُ النهائية. */
export function alertStats(rows: { status: string, severity: string }[]): StatItem[] {
  const fresh = rows.filter(a => a.status === 'new').length
  return [
    { key: 'all', icon: 'i-lucide-bell', value: rows.length, label: 'تنبيهاً' },
    { key: 'new', icon: 'i-lucide-bell-ring', tone: fresh ? 'err' : 'neutral', value: fresh, label: 'بانتظار الإقرار' },
    { key: 'ack', icon: 'i-lucide-check-check', tone: 'green', value: rows.filter(a => a.status === 'acknowledged').length, label: 'أُقِرّ بها' },
    { key: 'final', icon: 'i-lucide-triangle-alert', tone: 'neutral', value: rows.filter(a => a.severity === 'final_warning').length, label: 'إنذاراً نهائيّاً' }
  ]
}

/** نتائجُ الاختبارات: كلُّها، والمجتازون، وغيرُ المجتازين، ونسبةُ الاجتياز، ومتوسّطُ العلامة. */
export function examResultStats(rows: { passed: boolean | null, total_score: number | null }[], maxTotal: number): StatItem[] {
  const passed = rows.filter(r => r.passed === true).length
  const failed = rows.filter(r => r.passed === false).length
  const scores = rows.map(r => r.total_score).filter((s): s is number => s !== null)
  const decided = passed + failed
  return [
    { key: 'all', icon: 'i-lucide-clipboard-list', value: rows.length, label: 'نتيجة اختبار' },
    { key: 'passed', icon: 'i-lucide-award', tone: 'green', value: passed, label: 'مجتازاً', ...(decided ? { sub: `${Math.round((passed / decided) * 100)}٪ من المحسوم` } : {}) },
    { key: 'failed', icon: 'i-lucide-rotate-ccw', tone: failed ? 'err' : 'neutral', value: failed, label: 'غيرَ مجتاز (يعيد)' },
    // الرقمُ وحده (كان «87.5 / 99» ينكسر سطرين على الجوال)، والحدُّ في التسمية
    { key: 'avg', icon: 'i-lucide-gauge', value: scores.length ? String(round1(scores.reduce((a, b) => a + b, 0) / scores.length)) : '—', label: `متوسّطُ العلامة من ${maxTotal}` }
  ]
}

/** خطةُ الاختبارات: الدوراتُ، والمراحلُ، والأجزاءُ التي تغطّيها، وأطولُ دورة. */
export function examPlanStats(cycles: { stage_number: number, parts_from: number, parts_to: number }[]): StatItem[] {
  const covered = new Set<number>()
  let longest = 0
  for (const c of cycles) {
    for (let j = c.parts_from; j <= c.parts_to; j++) covered.add(j)
    longest = Math.max(longest, c.parts_to - c.parts_from + 1)
  }
  return [
    { key: 'cycles', icon: 'i-lucide-list-ordered', value: cycles.length, label: 'دورةً مرحليّة' },
    { key: 'stages', icon: 'i-lucide-layers', tone: 'neutral', value: new Set(cycles.map(c => c.stage_number)).size, label: 'مراحل' },
    { key: 'parts', icon: 'i-lucide-book-open', tone: 'green', value: covered.size, label: 'جزءاً تغطّيه الخطة' },
    { key: 'longest', icon: 'i-lucide-ruler', value: longest, label: 'أجزاءً في أطول دورة' }
  ]
}

/** المستخدمون (العاملون): النشطون، والمعطَّلون، والمعلّمون، والمشرفون الميدانيون — نشطين. */
export function userStats(rows: { status: string, role: string }[]): StatItem[] {
  const active = rows.filter(u => u.status === 'active')
  return [
    { key: 'active', icon: 'i-lucide-users', value: active.length, label: 'حساباً نشطاً' },
    { key: 'disabled', icon: 'i-lucide-user-x', tone: 'neutral', value: rows.length - active.length, label: 'حساباً معطَّلاً' },
    { key: 'teachers', icon: 'i-lucide-book-open', tone: 'green', value: active.filter(u => u.role === 'teacher').length, label: 'معلّماً' },
    { key: 'supervisors', icon: 'i-lucide-clipboard-check', value: active.filter(u => u.role === 'field_supervisor').length, label: 'مشرفاً ميدانيّاً' }
  ]
}

/** المشرفون: عددُهم، والحلقاتُ المسندة، ومن بلا حلقة، ومتوسّطُ «إنجاز الزيارات» لشهر اليوم (لمن له حلقاتٌ نشطة). */
/** `female`: قسمُ البنات (المديرة الإدارية) — «مشرفةً ميدانيّة» (2026-10-22). */
export function supervisorStats(rows: { halqat: number, commitment: number | null }[], female = false): StatItem[] {
  const rated = rows.map(r => r.commitment).filter((c): c is number => c !== null)
  const idle = rows.filter(r => r.halqat === 0).length
  return [
    { key: 'sups', icon: 'i-lucide-users-round', value: rows.length, label: female ? 'مشرفةً ميدانيّة' : 'مشرفاً ميدانيّاً' },
    { key: 'halqat', icon: 'i-lucide-book-open', tone: 'green', value: rows.reduce((s, r) => s + r.halqat, 0), label: 'حلقةً مسندة' },
    { key: 'idle', icon: 'i-lucide-user-x', tone: idle ? 'err' : 'neutral', value: idle, label: 'بلا حلقة' },
    { key: 'commit', icon: 'i-lucide-gauge', value: rated.length ? `${Math.round(rated.reduce((a, b) => a + b, 0) / rated.length)}٪` : '—', label: 'متوسّطُ إنجاز الزيارات هذا الشهر' }
  ]
}

/** الأخبار: كلُّها، والمنشورة، والمسودّات، وأخبارُ هذا الشهر. */
export function newsStats(rows: { published: boolean, news_date: string }[], today: string): StatItem[] {
  return [
    { key: 'all', icon: 'i-lucide-newspaper', value: rows.length, label: 'خبراً' },
    { key: 'pub', icon: 'i-lucide-globe', tone: 'green', value: rows.filter(n => n.published).length, label: 'منشوراً' },
    { key: 'draft', icon: 'i-lucide-file-pen', tone: 'neutral', value: rows.filter(n => !n.published).length, label: 'مسودّة' },
    { key: 'month', icon: 'i-lucide-calendar', value: rows.filter(n => sameMonth(n.news_date, today)).length, label: 'خبراً هذا الشهر' }
  ]
}

/** المحاضر: كلُّها، والمعتمَدة، والمسودّات، ومحاضرُ هذا الشهر. */
export function minutesStats(rows: { status: string, meeting_date: string }[], today: string): StatItem[] {
  return [
    { key: 'all', icon: 'i-lucide-notebook-pen', value: rows.length, label: 'محضراً' },
    { key: 'final', icon: 'i-lucide-check-check', tone: 'green', value: rows.filter(m => m.status === 'final').length, label: 'معتمَداً' },
    { key: 'draft', icon: 'i-lucide-file-pen', tone: 'neutral', value: rows.filter(m => m.status === 'draft').length, label: 'مسودّة' },
    { key: 'month', icon: 'i-lucide-calendar', value: rows.filter(m => sameMonth(m.meeting_date, today)).length, label: 'اجتماعاً هذا الشهر' }
  ]
}
