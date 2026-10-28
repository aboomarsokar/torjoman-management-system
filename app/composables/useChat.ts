/**
 * المحادثاتُ الفورية (طلب المستخدم 2026-10-27): قائمةُ محادثاتي بعدد غير المقروء (حالةٌ مشتركةٌ تقرؤها القائمةُ
 * الجانبية والصفحة)، ومن أستطيع محادثته، وبدءُ محادثةٍ فردية. القراءةُ بدوالّ `my_chats` و`chat_contacts`، والصلاحيةُ في القاعدة.
 */
import type { Database } from '~/types/database.types'

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

/** يضيف رسالةً واردةً مرّةً واحدةً بترتيب وقتها (قد تصل بالبثّ وبالقراءة معاً). */
export function mergeMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (list.some(m => m.id === msg.id)) return list
  return [...list, msg].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function useChatList() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const chats = useState<ChatRow[]>('chat-list', () => [])
  const loaded = useState<boolean>('chat-list-loaded', () => false)
  const unread = computed(() => totalUnread(chats.value))

  async function refresh() {
    const { data, error } = await supabase.rpc('my_chats')
    if (error) return handle(error)
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

  return { chats, loaded, unread, refresh, clearUnread, contacts, startWith }
}
