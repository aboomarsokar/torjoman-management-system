/**
 * صندوقُ الإشعارات المخزّنة — قراءةُ آخر 30 وعدُّ غير المقروء والاشتراكُ الفوريّ والتعليم.
 * الدوالّ النقيّة أدناه مُصدَّرةٌ ومختبَرة في useInbox.test.ts.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { INBOX_LIMIT } from '~/constants/notifications'
import type { Database } from '~/types/database.types'

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

/**
 * يقرأ الصندوق ويعدّ غير المقروء ويشترك في الوارد الفوريّ لصاحب الجلسة،
 * مع استطلاعٍ احتياطيّ كلّ دقيقة (يتوقّف والتبويب مخفيّ).
 */
export function useInbox() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const rows = ref<InboxRow[]>([])
  const unread = ref(0)
  const { handle } = useErrorHandler()

  async function load() {
    const uid = user.value?.sub
    if (!uid) {
      rows.value = []
      unread.value = 0
      return
    }
    const [list, count] = await Promise.all([
      supabase.from('notifications')
        .select('id, kind, title, body, link, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(INBOX_LIMIT),
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
    ])
    if (list.error) {
      handle(list.error)
      return
    }
    rows.value = list.data ?? []
    unread.value = count.count ?? 0
  }

  async function markRead(ids: string[] | null) {
    const { data, error } = await supabase.rpc('mark_notifications_read', ids ? { p_ids: ids } : {})
    if (error) {
      handle(error)
      return
    }
    rows.value = markRowsRead(rows.value, ids, new Date().toISOString())
    unread.value = Math.max(0, unread.value - (data ?? 0))
  }

  let channel: RealtimeChannel | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  function subscribe(uid: string) {
    channel?.unsubscribe()
    channel = supabase.channel(`inbox:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as InboxRow
          // قد يكون الصفّ وصل قبلُ بالاستطلاع — فلا يُعدّ مرّتين
          const known = rows.value.some(r => r.id === row.id)
          rows.value = mergeIncoming(rows.value, row)
          if (!known && !row.read_at) unread.value += 1
        })
      .subscribe()
  }

  function onVisible() {
    if (!document.hidden) load()
  }

  onMounted(() => {
    load()
    const uid = user.value?.sub
    if (uid) subscribe(uid)
    // احتياطٌ إن انقطع الاتصال الفوريّ — ويتوقّف والتبويب مخفيّ
    timer = setInterval(() => {
      if (!document.hidden) load()
    }, 60000)
    document.addEventListener('visibilitychange', onVisible)
  })
  onUnmounted(() => {
    channel?.unsubscribe()
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { rows, unread, load, markRead }
}
