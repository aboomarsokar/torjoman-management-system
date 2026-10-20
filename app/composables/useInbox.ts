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
  source_id: string | null
  read_at: string | null
  created_at: string
}

/**
 * أنواعٌ تستبدل القاعدةُ خبرَها غيرَ المقروء بخبرٍ جديد (تحذف القديم ثم تُدرج): خبرُ التسديد واحدٌ لكلّ صاحبٍ وشهر.
 * الجرسُ لا يسمع الحذف، فالواصلُ منها يُسقط غيرَ المقروء من نوعه ورابطه.
 */
export const REPLACEABLE_KINDS: readonly string[] = ['transport_paid']

/** هل يحلّ `next` محلَّ `prev`؟ (النوعُ نفسُه القابلُ للاستبدال، والرابطُ نفسُه، وكلاهما غيرُ مقروء). */
export function replacedBy(prev: InboxRow, next: InboxRow): boolean {
  return prev.id !== next.id && !prev.read_at && !next.read_at
    && prev.kind === next.kind && prev.link === next.link && REPLACEABLE_KINDS.includes(next.kind)
}

/** يدمج صفّاً واصلاً (فوريّاً أو باستطلاع) بلا تكرار، بترتيب الوقت النازل، مقصوصاً عند الحدّ. */
export function mergeIncoming(rows: InboxRow[], row: InboxRow, limit = INBOX_LIMIT): InboxRow[] {
  return [row, ...rows.filter(r => r.id !== row.id && !replacedBy(r, row))]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit)
}

/**
 * يدمج قراءةً كاملة في الصفوف الحاليّة بلا تكرار: قراءةٌ بدأت قبل وصولِ صفٍّ فوريّ لا تُسقطه.
 * القراءةُ لا تتراجع — صفٌّ مقروءٌ في أيٍّ من الجهتين يبقى مقروءاً.
 */
export function mergeRows(current: InboxRow[], fetched: InboxRow[], limit = INBOX_LIMIT): InboxRow[] {
  // صفٌّ في اليد غائبٌ عن القراءة وليس أحدثَ منها حُذف في القاعدة (خبرٌ استُبدل) — يسقط
  const fetchedIds = new Set(fetched.map(r => r.id))
  const newestFetched = Math.max(-Infinity, ...fetched.map(r => Date.parse(r.created_at)))
  const kept = current.filter(r => fetchedIds.has(r.id) || Date.parse(r.created_at) > newestFetched)
  const byId = new Map<string, InboxRow>()
  for (const r of [...kept, ...fetched]) {
    const prev = byId.get(r.id)
    byId.set(r.id, prev ? { ...r, read_at: prev.read_at ?? r.read_at } : r)
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit)
}

/**
 * قرارُ الرنين بالهويّة لا بفرق العدّ: الجديدُ كلُّ إشعارٍ غيرِ مقروء لم يُرَ من قبل.
 * `seen = null` أوّلُ قراءةٍ ناجحة: تُعتمد كلُّ معرّفاتها أساساً، وغيرُ المقروء فيها جديد (يرنّ مرّةً).
 * بعدها: الجديدُ ما لم يكن في `seen`؛ ومن صار مقروءاً أو خرج من النافذة لا يُعدّ جديداً.
 * لا تعدّل المجموعةَ المُمرَّرة بل تُرجع واحدةً جديدة.
 */
export function newUnreadIds(seen: Set<string> | null, rows: InboxRow[]): { seen: Set<string>, fresh: string[] } {
  const next = new Set(seen ?? [])
  const fresh: string[] = []
  for (const r of rows) {
    if (!r.read_at && !(seen?.has(r.id))) fresh.push(r.id)
    next.add(r.id)
  }
  return { seen: next, fresh }
}

/** يعلّم المحدَّد (أو الكلّ إن كانت `null`) مقروءاً محلّياً، ولا يغيّر وقتَ ما قُرئ قبلُ. */
export function markRowsRead(rows: InboxRow[], ids: string[] | null, at: string): InboxRow[] {
  return rows.map(r => (r.read_at || (ids && !ids.includes(r.id))) ? r : { ...r, read_at: at })
}

/**
 * يُسقط من طابور «بانتظارك» ما يمثّله خبرٌ غيرُ مقروء، كي لا يُعدّ العملُ الواحد مرّتين
 * (تنبيهٌ إداريّ أو زيارةٌ مجدولة تُنتج بنداً في الطابور وخبراً مخزّناً معاً، ومعرّفاهما واحد = source_id).
 * ما دام الخبر غيرَ مقروء فهو الذي يمثّل البند؛ وإذا قُرئ والبندُ ما زال منتظراً عاد البندُ إلى الطابور ويُعدّ.
 */
export function pendingQueue<T extends { id: string }>(queue: T[], rows: InboxRow[]): T[] {
  const represented = new Set<string>()
  for (const r of rows) {
    if (r.read_at === null && r.source_id) represented.add(r.source_id)
  }
  return queue.filter(q => !represented.has(q.id))
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
 * الاشتراكُ يتبع المستخدم: يتبدّل بتبدّله ويزول بخروجه، و`loaded` يصير true بعد أوّل قراءةٍ ناجحة
 * (قبلها يكون العدّ صفراً ابتدائيّاً لا قيمةً حقيقيّة).
 */
export function useInbox() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const rows = ref<InboxRow[]>([])
  const unread = ref(0)
  const loaded = ref(false)
  const { handle } = useErrorHandler()

  async function load() {
    const uid = user.value?.sub
    if (!uid) {
      rows.value = []
      unread.value = 0
      loaded.value = false
      return
    }
    const [list, count] = await Promise.all([
      supabase.from('notifications')
        .select('id, kind, title, body, link, source_id, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(INBOX_LIMIT),
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
    ])
    // تبدّل المستخدم أثناء الانتظار: ردٌّ قديم لا يُكتب فوق حالة الجديد
    if (user.value?.sub !== uid) return
    // فشلُ إحدى القراءتين لا يُصفِّر العدّاد ولا يمسّ ما في اليد
    const failure = list.error ?? count.error
    if (failure) {
      handle(failure)
      return
    }
    // دمجٌ لا استبدال: قراءةٌ بدأت قبل وصول صفٍّ فوريّ لا تُسقطه (العدّ من الاستعلام)
    rows.value = mergeRows(rows.value, list.data ?? [])
    unread.value = count.count ?? 0
    loaded.value = true
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

  function dropChannel() {
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }

  function subscribe(uid: string) {
    dropChannel()
    // اسمٌ فريد لكلّ نسخة: نسختان بالاسم نفسه تشتركان في قناةٍ واحدة فتسقط إحداهما
    channel = supabase.channel(`inbox:${uid}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as InboxRow
          // قد يكون الصفّ وصل قبلُ بالاستطلاع — فلا يُعدّ مرّتين
          const known = rows.value.some(r => r.id === row.id)
          // خبرٌ يستبدل خبراً غيرَ مقروء (حُذف في القاعدة) لا يزيد العدّاد
          const replaced = rows.value.filter(r => replacedBy(r, row)).length
          rows.value = mergeIncoming(rows.value, row)
          if (!known && !row.read_at) unread.value = Math.max(0, unread.value + 1 - replaced)
        })
      .subscribe()
  }

  function onVisible() {
    if (!document.hidden) load()
  }

  // يتبع المستخدم: قناةٌ جديدة وقراءةٌ جديدة عند تبدّله، وتفريغٌ عند خروجه
  watch(() => user.value?.sub, (uid) => {
    if (!import.meta.client) return
    rows.value = []
    unread.value = 0
    loaded.value = false
    if (uid) subscribe(uid)
    else dropChannel()
    load()
  }, { immediate: true })

  onMounted(() => {
    // احتياطٌ إن انقطع الاتصال الفوريّ — ويتوقّف والتبويب مخفيّ
    timer = setInterval(() => {
      if (!document.hidden) load()
    }, 60000)
    document.addEventListener('visibilitychange', onVisible)
  })
  onUnmounted(() => {
    dropChannel()
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { rows, unread, loaded, load, markRead }
}
