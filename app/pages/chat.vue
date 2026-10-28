<script setup lang="ts">
/**
 * «المحادثات» (طلب المستخدم 2026-10-27): محادثاتٌ فوريةٌ بين الإدارة فيما بينها، وبين الإدارة والكادر، والمشرفِ
 * والمختبِر ومعلّمي حلقاتهما — فرديةٌ ومجموعاتٌ ثابتة، بـ«متصل الآن / آخر ظهور». القائمةُ وبجانبها المحادثة،
 * وعلى الجوال واحدةٌ بعد الأخرى. المحادثةُ المفتوحة في `?c=` فتُفتح من التنبيه مباشرة.
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'المحادثات — ترجمان' })

const route = useRoute()
const router = useRouter()
const { profile } = useProfile()
const { chats, loaded, refresh, startWith, contacts } = useChatList()

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
  if (!chats.value.some(c => c.id === id)) await refresh()
  // محادثةٌ بلا رسائلَ لا تأتي في القائمة: تُضاف مؤقّتاً من بيانات المختار حتى أوّل رسالة
  if (!chats.value.some(c => c.id === id)) {
    const person = (await contacts()).find(c => c.id === otherId)
    if (person) {
      chats.value = [{
        id, kind: 'direct', group_key: null as never, title: null as never, other_id: person.id, other_name: person.full_name,
        other_role: person.role, other_gender: person.gender, other_avatar: person.avatar_url, other_last_seen: person.last_seen_at,
        last_message: null as never, last_message_at: null as never, last_sender_id: null as never, unread: 0, members: 2, last_read_by_others: false
      }, ...chats.value]
    }
  }
  openChat(id)
}
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
.chat { display: flex; flex-direction: column; gap: 16px; }
.chat-box { display: grid; grid-template-columns: 340px 1fr; height: calc(100dvh - 220px); min-height: 460px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); overflow: hidden; box-shadow: var(--shadow); }
.chat-side { border-inline-end: 1px solid var(--line); overflow-y: auto; min-height: 0; }
.chat-main { min-height: 0; display: flex; flex-direction: column; }
.chat-main > :deep(.empty), .chat-main > :deep(section:not(.th)) { margin: auto; }
@media (max-width: 900px) {
  .chat-box { grid-template-columns: 1fr; height: calc(100dvh - 190px); }
  .chat-box.has-active .chat-side { display: none; }
  .chat-box:not(.has-active) .chat-main { display: none; }
}
</style>
