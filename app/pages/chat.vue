<script setup lang="ts">
/**
 * «المحادثات» (طلب المستخدم 2026-10-27): محادثاتٌ فوريةٌ بين الإدارة فيما بينها، وبين الإدارة والكادر، والمشرفِ
 * والمختبِر ومعلّمي حلقاتهما — فرديةٌ ومجموعاتٌ ثابتة، بـ«متصل الآن / آخر ظهور». القائمةُ وبجانبها المحادثة،
 * وعلى الجوال واحدةٌ بعد الأخرى. المحادثةُ المفتوحة في `?c=` فتُفتح من التنبيه مباشرة.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'المحادثات — ترجمان' })

const route = useRoute()
const router = useRouter()
const { profile } = useProfile()
const supabase = useSupabaseClient<Database>()
const { chats, loaded, refresh, startWith } = useChatList()

const activeId = computed(() => (typeof route.query.c === 'string' ? route.query.c : null))
const active = computed(() => chats.value.find(c => c.id === activeId.value) ?? null)
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tick = setInterval(() => (now.value = Date.now()), 30_000)
  if (!loaded.value) void refresh()
})
onBeforeUnmount(() => tick && clearInterval(tick))

function openChat(id: string | null) {
  void router.replace({ query: id ? { c: id } : {} })
}

const newOpen = ref(false)
async function pick(otherId: string) {
  const id = await startWith(otherId)
  if (!id) return
  newOpen.value = false
  openChat(id)
}

// مسوّدةٌ جاءت من صفحات الطلبات (`?d=`): تُسلَّم لخانة الكتابة مرّةً ثم تُزال من الرابط
const initialDraft = ref<string | undefined>(typeof route.query.d === 'string' ? route.query.d : undefined)
onMounted(() => {
  if (initialDraft.value && activeId.value) void router.replace({ query: { c: activeId.value } })
})
watch(activeId, (next, prev) => {
  if (prev && next !== prev) initialDraft.value = undefined
})

/** محادثةٌ فرديةٌ بلا رسائلَ لا تأتي في القائمة: تُضاف مؤقّتاً من أعضائها حتى أوّل رسالة. */
async function ensureChat(id: string) {
  if (chats.value.some(c => c.id === id)) return
  await refresh()
  if (chats.value.some(c => c.id === id)) return
  const { data } = await supabase.rpc('chat_conversation_members', { p_conversation: id })
  const other = (data ?? []).find(m => m.id !== profile.value?.id)
  if (!other) return
  chats.value = [{
    id, kind: 'direct', group_key: null as never, title: null as never, other_id: other.id, other_name: other.full_name,
    other_role: other.role, other_gender: other.gender, other_avatar: other.avatar_url, other_last_seen: other.last_seen_at,
    last_message: null as never, last_message_at: null as never, last_sender_id: null as never, unread: 0, members: 2, last_read_by_others: false
  }, ...chats.value]
}
watch([activeId, loaded], ([id, ok]) => {
  if (id && ok) void ensureChat(id)
}, { immediate: true })
</script>

<template>
  <div class="chat">
    <UiPageHeader
      title="المحادثات"
      subtitle="محادثاتٌ فوريةٌ مع الإدارة والكادر — خاصّةٌ بأطرافها."
    >
      <template #actions>
        <UButton
          label="محادثة جديدة"
          icon="i-lucide-message-circle-plus"
          color="primary"
          size="lg"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="newOpen = true"
        />
      </template>
    </UiPageHeader>
    <ClientOnly>
      <div
        class="chat-box"
        :class="{ 'has-active': !!active }"
      >
        <aside class="chat-side">
          <UiSkeletonRow
            v-if="!loaded"
            :action="false"
          />
          <ChatList
            v-else
            :chats="chats"
            :active-id="activeId"
            :me="profile?.id ?? null"
            :now="now"
            @open="openChat"
          />
        </aside>
        <div class="chat-main">
          <ChatThread
            v-if="active"
            :key="active.id"
            :chat="active"
            :me="profile?.id ?? null"
            :now="now"
            :initial-draft="initialDraft"
            @back="openChat(null)"
          />
          <UiEmptyState
            v-else
            icon="i-lucide-messages-square"
            title="اختر محادثة"
            description="أو ابدأ محادثةً جديدة مع أحد الإدارة أو الكادر."
          />
        </div>
      </div>
    </ClientOnly>
    <ChatNewChatModal
      v-model:open="newOpen"
      :now="now"
      @pick="pick"
    />
  </div>
</template>

<style scoped>
/* الصفحةُ تملأ ما تحت الشريط العلويّ بالضبط فلا تمريرَ للنافذة (طلب المستخدم 2026-10-28): الشريطُ 76px،
   وحشوةُ المحتوى أعلى وأسفل (`--content-pad`، والأسفلُ يزيد 60px) */
.chat { --chat-top: 76px; display: flex; flex-direction: column; gap: 16px;
  height: calc(100dvh - var(--chat-top) - 2 * var(--content-pad, 24px) - 60px); min-height: 360px; }
.chat-box { flex: 1; min-height: 0; display: grid; grid-template-columns: 340px 1fr; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); overflow: hidden; box-shadow: var(--shadow); }
.chat-side { border-inline-end: 1px solid var(--line); overflow-y: auto; min-height: 0; }
.chat-main { min-height: 0; display: flex; flex-direction: column; }
.chat-main > :deep(.empty), .chat-main > :deep(section:not(.th)) { margin: auto; }
@media (max-width: 900px) {
  .chat-box { grid-template-columns: 1fr; }
  .chat-box.has-active .chat-side { display: none; }
  .chat-box:not(.has-active) .chat-main { display: none; }
}
</style>
