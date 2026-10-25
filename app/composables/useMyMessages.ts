/**
 * رسائلُ الإدارة — جهةُ المستلم (طلب المستخدم 2026-10-25): ما وصله بحالة مشاهدته، وعددُ غير المقروء لرقم القائمة
 * (حالةٌ مشتركة بين القائمة والصفحة). فتحُ الصفحة يسجّل المشاهدة (`mark_staff_messages_seen` — والنيابةُ لا تُحتسب).
 */
import type { Database } from '~/types/database.types'
import { MESSAGE_RECIPIENT_ROLES } from '~/constants/announcements'

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

  const { data: messages, pending } = useLazyAsyncData<MyMessage[]>('my-staff-messages', async () => {
    const me = profile.value?.id
    if (!me) return []
    const { data, error } = await supabase.from('staff_message_recipients')
      .select('seen_at, message:message_id(id, title, body, link, created_at, sender:sent_by(full_name))')
      .eq('recipient_id', me)
      .returns<MyMessage[]>()
    if (error) handle(error)
    return newestFirst(data ?? [])
  }, { server: false, default: () => [], watch: [() => profile.value?.id] })

  /** ما كان جديداً عند الفتح — يبقى بارزاً في هذه الزيارة ولو سُجّلت مشاهدتُه. */
  const freshIds = ref<Set<string>>(new Set())

  watch(messages, async (list) => {
    const unseen = (list ?? []).filter(m => !m.seen_at).map(m => m.message!.id)
    if (!unseen.length) return
    freshIds.value = new Set([...freshIds.value, ...unseen])
    const { data, error } = await supabase.rpc('mark_staff_messages_seen', { p_ids: unseen })
    if (error) return handle(error)
    if (data) unread.value = Math.max(0, unread.value - data)
  })

  return { messages, pending, freshIds }
}
