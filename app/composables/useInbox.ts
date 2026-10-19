/**
 * صندوقُ الإشعارات المخزّنة — قراءةُ آخر 30 وعدُّ غير المقروء والاشتراكُ الفوريّ والتعليم.
 * الدوالّ النقيّة أدناه مُصدَّرةٌ ومختبَرة في useInbox.test.ts.
 */
import { INBOX_LIMIT } from '~/constants/notifications'

export interface InboxRow {
  id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

/** يدمج صفّاً واصلاً (فوريّاً أو باستطلاع) بلا تكرار، بترتيب الوقت النازل، مقصوصاً عند الحدّ. */
export function mergeIncoming(rows: InboxRow[], row: InboxRow, limit = INBOX_LIMIT): InboxRow[] {
  return [row, ...rows.filter(r => r.id !== row.id)]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit)
}

/** يعلّم المحدَّد (أو الكلّ إن كانت `null`) مقروءاً محلّياً، ولا يغيّر وقتَ ما قُرئ قبلُ. */
export function markRowsRead(rows: InboxRow[], ids: string[] | null, at: string): InboxRow[] {
  return rows.map(r => (r.read_at || (ids && !ids.includes(r.id))) ? r : { ...r, read_at: at })
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** «الآن» · «منذ N د» · «منذ N س» · وبعد يومٍ: اليوم-الشهر بالأرقام. */
export function relativeTimeAr(iso: string, now: Date): string {
  const then = new Date(iso)
  const diff = now.getTime() - then.getTime()
  if (diff < MINUTE) return 'الآن'
  if (diff < HOUR) return `منذ ${Math.floor(diff / MINUTE)} د`
  if (diff < DAY) return `منذ ${Math.floor(diff / HOUR)} س`
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit' })
    .formatToParts(then)
  const day = parts.find(p => p.type === 'day')!.value
  const month = parts.find(p => p.type === 'month')!.value
  return `${day}-${month}`
}
