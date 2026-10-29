/**
 * محادثةٌ مفتوحة (طلب المستخدم 2026-10-27): آخرُ رسائلها وأعضاؤها بآخر قراءة كلٍّ منهم، والإرسال، وتعليمُها مقروءة،
 * والبثُّ اللحظيّ لرسائلها الجديدة ولقراءة الآخرين (علامة «قُرئت»)، وحذفُ المرسِل رسالتَه للجميع (2026-10-29).
 * القناةُ تتبع المحادثةَ المفتوحة وتُغلق عند المغادرة.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { CHAT_MAX_BODY, CHAT_PAGE_SIZE } from '~/constants/chat'
import { mergeMessage, type ChatMember, type ChatMessage } from '~/composables/useChat'

export function useChatThread(conversationId: Ref<string | null>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { clearUnread } = useChatList()
  const messages = ref<ChatMessage[]>([])
  const members = ref<ChatMember[]>([])
  const loading = ref(false)
  const sending = ref(false)
  let channel: RealtimeChannel | null = null

  async function markRead() {
    const id = conversationId.value
    if (!id || document.hidden) return
    clearUnread(id)
    const { error } = await supabase.rpc('mark_chat_read', { p_conversation: id })
    if (error) handle(error)
  }

  async function load(id: string) {
    loading.value = true
    const [msgs, mems] = await Promise.all([
      supabase.from('chat_messages').select('*').eq('conversation_id', id)
        .order('created_at', { ascending: false }).limit(CHAT_PAGE_SIZE),
      supabase.rpc('chat_conversation_members', { p_conversation: id })
    ])
    loading.value = false
    if (conversationId.value !== id) return
    if (msgs.error || mems.error) return handle(msgs.error ?? mems.error)
    messages.value = (msgs.data ?? []).reverse()
    members.value = mems.data ?? []
    void markRead()
  }

  function subscribe(id: string) {
    dropChannel()
    channel = supabase.channel(`chat:${id}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          messages.value = mergeMessage(messages.value, payload.new as ChatMessage)
          void markRead()
        })
      // الحذفُ تعديلٌ للصفّ (نصٌّ فارغ ووقتُ الحذف): يُستبدل عند الطرفين لحظياً
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          messages.value = mergeMessage(messages.value, payload.new as ChatMessage)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_members', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const row = payload.new as { profile_id: string, last_read_at: string }
          members.value = members.value.map(m => (m.id === row.profile_id ? { ...m, last_read_at: row.last_read_at } : m))
        })
      .subscribe()
  }

  function dropChannel() {
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }

  async function send(body: string): Promise<boolean> {
    const id = conversationId.value
    const text = body.trim()
    if (!id || !text) return false
    if (text.length > CHAT_MAX_BODY) {
      handle(new Error(`الرسالة أطول من ${CHAT_MAX_BODY} حرف.`))
      return false
    }
    sending.value = true
    const { data, error } = await supabase.rpc('send_chat_message', { p_conversation: id, p_body: text })
    sending.value = false
    if (error) {
      handle(error)
      return false
    }
    // تظهر فوراً بصفّها من الخادم (بوقته لا بساعة الجهاز التي قد تختلف فتقلب الترتيب)، والبثُّ يأتي بالنسخة نفسها
    const { data: row } = await supabase.from('chat_messages').select('*').eq('id', data).maybeSingle()
    if (row) messages.value = mergeMessage(messages.value, row)
    return true
  }

  /** يحذف المرسِلُ رسالتَه للجميع — يُمحى نصُّها ويبقى مكانُها «حُذفت هذه الرسالة». */
  async function remove(messageId: string): Promise<boolean> {
    const { error } = await supabase.rpc('delete_chat_message', { p_message: messageId })
    if (error) {
      handle(error)
      return false
    }
    const { data: row } = await supabase.from('chat_messages').select('*').eq('id', messageId).maybeSingle()
    if (row) messages.value = mergeMessage(messages.value, row)
    return true
  }

  function onVisible() {
    if (!document.hidden) void markRead()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisible)
    watch(conversationId, (id) => {
      messages.value = []
      members.value = []
      dropChannel()
      if (id) {
        subscribe(id)
        void load(id)
      }
    }, { immediate: true })
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible)
    dropChannel()
  })

  return { messages, members, loading, sending, send, remove }
}
