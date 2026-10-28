/**
 * المحادثاتُ الفورية (طلب المستخدم 2026-10-27): قائمةُ محادثاتي بعدد غير المقروء (حالةٌ مشتركةٌ تقرؤها القائمةُ
 * الجانبية والصفحة)، ومن أستطيع محادثته، وبدءُ محادثةٍ فردية. القراءةُ بدوالّ `my_chats` و`chat_contacts`، والصلاحيةُ في القاعدة.
 */
import type { Database } from '~/types/database.types'
import { isOnlineNow } from '~/utils/reachability'

type Fns = Database['public']['Functions']
export type ChatRow = Fns['my_chats']['Returns'][number]
export type ChatContact = Fns['chat_contacts']['Returns'][number]
export type ChatMember = Fns['chat_conversation_members']['Returns'][number]
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

/** عنوانُ المحادثة: اسمُ المجموعة، أو اسمُ الطرف الآخر. */
export function chatTitle(c: Pick<ChatRow, 'kind' | 'title' | 'other_name'>): string {
  return (c.kind === 'group' ? c.title : c.other_name) || 'محادثة'
}

/** مجموعُ غير المقروء في المحادثات كلّها. */
export function totalUnread(rows: Pick<ChatRow, 'unread'>[]): number {
  return rows.reduce((n, r) => n + (r.unread ?? 0), 0)
}

/**
 * يضيف رسالةً مرّةً واحدةً بترتيب وقتها، ويستبدل نسختَها إن وُجدت (قد تصل بالبثّ وبالقراءة معاً).
 * الاستبدالُ يُصلح نسخةً معروضةً بوقتٍ غيرِ دقيق — الوقتُ الصحيح من الخادم وحده (ساعةُ الجهاز قد تختلف).
 */
export function mergeMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  const old = list.find(m => m.id === msg.id)
  if (old && old.created_at === msg.created_at && old.body === msg.body) return list
  return [...list.filter(m => m.id !== msg.id), msg].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function useChatList() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const chats = useState<ChatRow[]>('chat-list', () => [])
  const loaded = useState<boolean>('chat-list-loaded', () => false)
  const router = useRouter()
  const unread = computed(() => totalUnread(chats.value))

  async function refresh() {
    // بلا اتصال لا يُطلب ولا يُنبَّه: يناديه المراقبُ في الخلفية فكان «تعذّر الاتصال بالخادم» يظهر على لوحة المعلّم
    // المفتوحة بلا إنترنت (تجربةُ الجوال 2026-10-28)
    if (!isOnlineNow()) return
    const { data, error } = await supabase.rpc('my_chats')
    if (error) return isOnlineNow() ? handle(error) : undefined
    chats.value = data ?? []
    loaded.value = true
  }

  /** بعد القراءة: يُصفَّر عدّادُها محلّياً دون انتظار القائمة. */
  function clearUnread(id: string) {
    chats.value = chats.value.map(c => (c.id === id ? { ...c, unread: 0 } : c))
  }

  async function contacts(): Promise<ChatContact[]> {
    const { data, error } = await supabase.rpc('chat_contacts')
    if (error) {
      handle(error)
      return []
    }
    return data ?? []
  }

  async function startWith(otherId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('start_direct_chat', { p_other: otherId })
    if (error) {
      handle(error)
      return null
    }
    return data
  }

  /** يرسل نصّاً في محادثةٍ خاصّةٍ مع شخص (يبدؤها إن لم تكن) ويُعيد معرّفَها، أو null عند الخطأ. */
  async function sendDirect(otherId: string, text: string): Promise<string | null> {
    const id = await startWith(otherId)
    if (!id) return null
    const { error } = await supabase.rpc('send_chat_message', { p_conversation: id, p_body: text })
    if (error) {
      handle(error)
      return null
    }
    void refresh()
    return id
  }

  /** يفتح محادثةً خاصّةً مع شخص ومعه مسوّدةٌ في خانة الكتابة (لا تُرسَل) — من صفحات الطلبات (2026-10-28). */
  async function openWithDraft(otherId: string, draft: string): Promise<boolean> {
    const id = await startWith(otherId)
    if (!id) return false
    await router.push({ path: '/chat', query: { c: id, d: draft } })
    return true
  }

  return { chats, loaded, unread, refresh, clearUnread, contacts, startWith, sendDirect, openWithDraft }
}
