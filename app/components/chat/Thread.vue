<script setup lang="ts">
/**
 * المحادثةُ المفتوحة (طلب المستخدم 2026-10-27): رأسٌ بالاسم و«متصل الآن / آخر ظهور» (أو عددِ أعضاء المجموعة)،
 * والرسائلُ بفواصل الأيام واسمِ المرسِل في المجموعة وعلامةِ «قُرئت» في الفردية، وخانةُ الكتابة (Enter يرسل).
 */
import { chatTitle, type ChatRow } from '~/composables/useChat'
import { CHAT_MAX_BODY } from '~/constants/chat'
import { roleLabel } from '~/constants/roles'
import { dayLabel, isOnline, lastSeenLabel, membersLabel, messageTime, readByOthers, startsNewDay } from '~/utils/chat'

const props = defineProps<{ chat: ChatRow, me: string | null, now: number, initialDraft?: string }>()
const emit = defineEmits<{ back: [] }>()

const id = computed(() => props.chat.id)
const { messages, members, loading, sending, send } = useChatThread(id)
const draft = ref(props.initialDraft ?? '')
const scroller = ref<HTMLElement | null>(null)

const isGroup = computed(() => props.chat.kind === 'group')
const nameOf = computed(() => new Map(members.value.map(m => [m.id, m.full_name])))
const other = computed(() => members.value.find(m => m.id !== props.me) ?? null)
const lastSeen = computed(() => other.value?.last_seen_at ?? props.chat.other_last_seen)
const status = computed(() => (isGroup.value
  ? membersLabel(members.value.length || props.chat.members)
  : lastSeenLabel(lastSeen.value, props.now)))
const online = computed(() => !isGroup.value && isOnline(lastSeen.value, props.now))
const role = computed(() => (isGroup.value ? '' : roleLabel(props.chat.other_role as never, props.chat.other_gender as never)))

watch(() => messages.value.length, async () => {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
})

async function submit() {
  if (sending.value || !draft.value.trim()) return
  const text = draft.value
  draft.value = ''
  if (!(await send(text))) draft.value = text
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void submit()
  }
}
</script>

<template>
  <section
    class="th"
    :aria-label="chatTitle(chat)"
  >
    <header class="th-head">
      <UButton
        class="th-back"
        icon="i-lucide-arrow-right"
        color="neutral"
        variant="ghost"
        aria-label="رجوع إلى المحادثات"
        :ui="{ base: 'rounded-full min-h-11 min-w-11 justify-center' }"
        @click="emit('back')"
      />
      <span class="th-av">
        <UIcon
          v-if="isGroup"
          name="i-lucide-users-round"
          class="size-5"
        />
        <ProfileAvatar
          v-else
          :name="chat.other_name ?? '؟'"
          :zoomable="false"
        />
      </span>
      <div class="th-who">
        <h2>{{ chatTitle(chat) }}</h2>
        <p :class="{ on: online }">
          <span
            v-if="online"
            class="th-dot"
          />{{ status }}<template v-if="role">
            · {{ role }}
          </template>
        </p>
      </div>
    </header>

    <div
      ref="scroller"
      class="th-body"
      aria-live="polite"
    >
      <p
        v-if="loading && !messages.length"
        class="th-empty"
      >
        جارٍ التحميل…
      </p>
      <p
        v-else-if="!messages.length"
        class="th-empty"
      >
        لا رسائلَ بعد — ابدأ المحادثة.
      </p>
      <template
        v-for="(m, i) in messages"
        :key="m.id"
      >
        <div
          v-if="startsNewDay(messages[i - 1]?.created_at, m.created_at)"
          class="th-day"
        >
          <span>{{ dayLabel(m.created_at, now) }}</span>
        </div>
        <div
          class="th-msg"
          :class="{ mine: m.sender_id === me }"
        >
          <b
            v-if="isGroup && m.sender_id !== me && m.sender_id !== messages[i - 1]?.sender_id"
            class="th-from"
          >{{ nameOf.get(m.sender_id ?? '') ?? 'عضوٌ سابق' }}</b>
          <p>{{ m.body }}</p>
          <span class="th-meta">
            {{ messageTime(m.created_at) }}
            <UIcon
              v-if="m.sender_id === me"
              :name="readByOthers(m.created_at, members, me ?? '') ? 'i-lucide-check-check' : 'i-lucide-check'"
              class="th-tick"
              :class="{ read: readByOthers(m.created_at, members, me ?? '') }"
              :aria-label="readByOthers(m.created_at, members, me ?? '') ? (isGroup ? 'قرأها الجميع' : 'قُرئت') : 'أُرسلت'"
            />
          </span>
        </div>
      </template>
    </div>

    <form
      class="th-compose"
      @submit.prevent="submit"
    >
      <UTextarea
        v-model="draft"
        :rows="1"
        :maxrows="6"
        autoresize
        class="flex-1"
        :maxlength="CHAT_MAX_BODY"
        placeholder="اكتب رسالة…"
        aria-label="نصّ الرسالة"
        :ui="{ base: 'rounded-[14px] min-h-11 py-2.5' }"
        @keydown="onKey"
      />
      <UButton
        type="submit"
        icon="i-lucide-send-horizontal"
        color="primary"
        :loading="sending"
        :disabled="!draft.trim()"
        aria-label="إرسال"
        :ui="{ base: 'rounded-full min-h-11 min-w-11 justify-center', leadingIcon: 'rtl:-scale-x-100' }"
      />
    </form>
  </section>
</template>

<style scoped>
.th { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.th-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); }
.th-back { display: none; }
.th-av { flex: none; width: 42px; height: 42px; border-radius: 999px; overflow: hidden; display: grid; place-items: center; background: var(--blue-soft); color: var(--blue-ink); }
.th-who { min-width: 0; }
.th-who h2 { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-who p { margin: 0; font-size: 12px; color: var(--ink-3); display: flex; align-items: center; gap: 6px; }
.th-who p.on { color: var(--green-ink); font-weight: 500; }
.th-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--green); }
.th-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 6px; background: var(--surface-2); }
.th-empty { margin: auto; color: var(--ink-3); font-size: 14px; }
.th-day { display: flex; justify-content: center; margin: 8px 0; }
.th-day span { font-size: 12px; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); padding: 2px 12px; border-radius: 999px; }
.th-msg { align-self: flex-start; max-width: min(78%, 560px); background: var(--surface); border: 1px solid var(--line); border-radius: 16px; border-start-start-radius: 4px; padding: 8px 12px 6px; }
.th-msg.mine { align-self: flex-end; background: var(--blue-soft); border-color: transparent; border-start-start-radius: 16px; border-start-end-radius: 4px; }
.th-from { display: block; font-size: 12px; color: var(--blue-ink); font-weight: 600; margin-bottom: 2px; }
.th-msg p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; color: var(--ink); font-size: 15px; }
.th-meta { display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 11px; color: var(--ink-3); margin-top: 2px; }
.th-tick { width: 16px; height: 16px; color: var(--ink-3); }
.th-tick.read { color: var(--blue); }
.th-compose { display: flex; gap: 8px; align-items: flex-end; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--surface); }
@media (max-width: 900px) { .th-back { display: inline-flex; } }
</style>
