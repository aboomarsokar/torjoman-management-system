/**
 * مراقبُ المحادثات في القالب (طلب المستخدم 2026-10-27): نبضُ «آخر ظهور» ما دامت المنصّة مفتوحة، وتحديثُ القائمة،
 * وتنبيهٌ منبثقٌ عند رسالةٍ جديدةٍ في محادثةٍ غيرِ مفتوحة (لا يُحفظ في الجرس). البثُّ يحترم RLS فلا تصل إلا رسائلُ محادثاتي.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { CHAT_HEARTBEAT_MS, CHAT_LIST_REFRESH_MS } from '~/constants/chat'
import { chatTitle, type ChatMessage } from '~/composables/useChat'
import { isOnlineNow } from '~/utils/reachability'

/** المحادثةُ المفتوحة أمام المستخدم الآن — فلا يُنبَّه برسائلها. */
export function openConversationOf(path: string, query: Record<string, unknown>): string | null {
  return path === '/chat' && typeof query.c === 'string' ? query.c : null
}

export function useChatWatcher() {
  const supabase = useSupabaseClient<Database>()
  const { profile } = useProfile()
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const { chats, refresh } = useChatList()
  let channel: RealtimeChannel | null = null
  let beat: ReturnType<typeof setInterval> | null = null
  let poll: ReturnType<typeof setInterval> | null = null

  const enabled = computed(() => !!profile.value && profile.value.role !== 'student')

  async function touch() {
    if (!document.hidden && isOnlineNow()) await supabase.rpc('touch_presence')
  }

  async function onMessage(msg: ChatMessage) {
    if (msg.sender_id === profile.value?.id) return
    await refresh()
    if (openConversationOf(route.path, route.query) === msg.conversation_id && !document.hidden) return
    const chat = chats.value.find(c => c.id === msg.conversation_id)
    toast.add({
      title: chat ? chatTitle(chat) : 'رسالةٌ جديدة',
      description: msg.body.length > 90 ? `${msg.body.slice(0, 90)}…` : msg.body,
      icon: 'i-lucide-message-circle',
      color: 'secondary',
      actions: [{ label: 'افتح', onClick: () => { void router.push({ path: '/chat', query: { c: msg.conversation_id } }) } }]
    })
  }

  async function start() {
    stop()
    void refresh()
    void touch()
    beat = setInterval(touch, CHAT_HEARTBEAT_MS)
    poll = setInterval(refresh, CHAT_LIST_REFRESH_MS)
    // القالبُ يُركَّب قبل أن يحمل البثُّ رمزَ الجلسة: بلا رمزٍ تُحجب الرسائلُ بـRLS فلا يصل شيء
    const { data } = await supabase.auth.getSession()
    if (data.session) await supabase.realtime.setAuth(data.session.access_token)
    channel = supabase.channel(`chat-watch:${profile.value!.id}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        payload => void onMessage(payload.new as ChatMessage))
      .subscribe()
  }

  function stop() {
    if (beat) clearInterval(beat)
    if (poll) clearInterval(poll)
    beat = poll = null
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }

  function onVisible() {
    if (!document.hidden && enabled.value) {
      void touch()
      void refresh()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisible)
    watch(() => (enabled.value ? profile.value?.id : null), id => (id ? void start() : stop()), { immediate: true })
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible)
    stop()
  })
}
