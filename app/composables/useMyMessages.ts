/**
 * رسائلُ الإدارة — جهةُ المستلم (طلب المستخدم 2026-10-25): ما وصله بحالة مشاهدته، وعددُ غير المقروء لرقم القائمة
 * (حالةٌ مشتركة بين القائمة والصفحة). فتحُ الصفحة يسجّل المشاهدة (`mark_staff_messages_seen` — والنيابةُ لا تُحتسب).
 */
import type { Database } from '~/types/database.types'
import { MESSAGE_RECIPIENT_ROLES } from '~/constants/announcements'
import { isOnlineNow } from '~/utils/reachability'
import { fetchMyMessages, MESSAGES_PAGE_SIZE, SCREEN_KEYS, type MessagesPage } from '~/utils/teacherScreens'

export type MyMessage = {
  seen_at: string | null
  message: {
    id: string
    title: string
    body: string | null
    link: string | null
    created_at: string
    sender: { full_name: string } | null
  } | null
}

/** الأحدثُ أوّلاً، وبلا ما حُذفت رسالتُه. */
export function newestFirst(list: MyMessage[]): MyMessage[] {
  return list.filter(m => m.message).sort((a, b) => b.message!.created_at.localeCompare(a.message!.created_at))
}

/** عددُ غير المقروء — للقائمة الجانبية؛ يُحدَّث عند تبدّل الحساب والمسار. */
export function useUnreadMessages() {
  const supabase = useSupabaseClient<Database>()
  const { profile } = useProfile()
  const route = useRoute()
  const unread = useState<number>('staff-messages-unread', () => 0)

  async function refreshUnread() {
    const me = profile.value
    if (!me || !MESSAGE_RECIPIENT_ROLES.includes(me.role)) {
      unread.value = 0
      return
    }
    const { count } = await supabase.from('staff_message_recipients')
      .select('message_id', { count: 'exact', head: true })
      .eq('recipient_id', me.id).is('seen_at', null)
    unread.value = count ?? 0
  }

  onMounted(() => {
    watch([() => profile.value?.id, () => route.path], refreshUnread, { immediate: true })
  })

  return { unread, refreshUnread }
}

export function useMyMessages() {
  const supabase = useSupabaseClient<Database>()
  const { profile } = useProfile()
  const { handle } = useErrorHandler()
  const unread = useState<number>('staff-messages-unread', () => 0)

  // صفحةً صفحة من السيرفر (طلب المستخدم 2026-10-28)، والمعلّمُ تُحفظ له نسخةُ كلّ صفحةٍ فتحها تُعرض بلا إنترنت
  const page = ref(1)
  const { wrap } = useOfflineCopy()
  const pageKey = () => SCREEN_KEYS.myMessages(page.value)
  const { data, pending } = useLazyAsyncData<MessagesPage<MyMessage>>(pageKey, wrap(pageKey, async () => {
    const me = profile.value?.id
    if (!me) return { rows: [], total: 0 }
    try {
      return await fetchMyMessages<MyMessage>(supabase, me, page.value)
    } catch (err) {
      handle(err)
      return { rows: [], total: 0 }
    }
  }), { server: false, default: () => ({ rows: [], total: 0 }), watch: [() => profile.value?.id] })
  const messages = computed(() => data.value?.rows ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / MESSAGES_PAGE_SIZE)))

  /** ما كان جديداً عند الفتح — يبقى بارزاً في هذه الزيارة ولو سُجّلت مشاهدتُه. */
  const freshIds = ref<Set<string>>(new Set())

  watch(messages, async (list) => {
    const unseen = (list ?? []).filter(m => !m.seen_at).map(m => m.message!.id)
    // بلا اتصال لا تُسجَّل المشاهدة (تُسجَّل عند أوّل فتحٍ متّصل) — ويبقى الجديدُ بارزاً
    if (unseen.length && !isOnlineNow()) freshIds.value = new Set([...freshIds.value, ...unseen])
    if (!unseen.length || !isOnlineNow()) return
    freshIds.value = new Set([...freshIds.value, ...unseen])
    const { data, error } = await supabase.rpc('mark_staff_messages_seen', { p_ids: unseen })
    if (error) return handle(error)
    if (data) unread.value = Math.max(0, unread.value - data)
  })

  return { messages, pending, freshIds, page, total, pageCount }
}
