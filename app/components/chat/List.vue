<script setup lang="ts">
/**
 * قائمةُ المحادثات (طلب المستخدم 2026-10-27): المجموعاتُ والفردية، بآخر رسالةٍ ووقتِها وعددِ غير المقروء،
 * ونقطةُ «متصل» للطرف الآخر. الضغطُ يفتح المحادثة.
 */
import { chatTitle, type ChatRow } from '~/composables/useChat'
import { roleLabel } from '~/constants/roles'
import { isOnline, listTime, membersLabel } from '~/utils/chat'

defineProps<{ chats: ChatRow[], activeId: string | null, me: string | null, now: number }>()
const emit = defineEmits<{ open: [id: string] }>()

const subtitleOf = (c: ChatRow) => (c.kind === 'group' ? membersLabel(c.members) : roleLabel(c.other_role as never, c.other_gender as never))
</script>

<template>
  <ul
    class="cl"
    aria-label="المحادثات"
  >
    <li
      v-for="c in chats"
      :key="c.id"
    >
      <button
        type="button"
        class="cl-item"
        :class="{ active: c.id === activeId, unread: c.unread > 0 }"
        :aria-current="c.id === activeId ? 'true' : undefined"
        @click="emit('open', c.id)"
      >
        <span class="cl-av">
          <span class="cl-face">
            <UIcon
              v-if="c.kind === 'group'"
              name="i-lucide-users-round"
              class="size-5"
            />
            <ProfileAvatar
              v-else
              :name="c.other_name ?? '؟'"
              :zoomable="false"
            />
          </span>
          <span
            v-if="c.kind === 'direct' && isOnline(c.other_last_seen, now)"
            class="cl-dot"
            aria-label="متصل الآن"
          />
        </span>
        <span class="cl-main">
          <span class="cl-top">
            <b>{{ chatTitle(c) }}</b>
            <time>{{ listTime(c.last_message_at, now) }}</time>
          </span>
          <span class="cl-sub">{{ subtitleOf(c) }}</span>
          <span class="cl-last">
            <span class="cl-text">
              <template v-if="c.last_message"><UIcon
                v-if="c.last_sender_id === me"
                :name="c.last_read_by_others ? 'i-lucide-check-check' : 'i-lucide-check'"
                class="cl-tick"
                :class="{ read: c.last_read_by_others }"
                :aria-label="c.last_read_by_others ? 'قُرئت' : 'أُرسلت'"
              />{{ c.last_sender_id === me ? 'أنت: ' : '' }}{{ c.last_message }}</template>
              <template v-else>لا رسائلَ بعد</template>
            </span>
            <span
              v-if="c.unread"
              class="cl-badge"
              :aria-label="`${c.unread} غير مقروءة`"
            >{{ c.unread > 99 ? '99+' : c.unread }}</span>
          </span>
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.cl { list-style: none; margin: 0; padding: 4px; display: flex; flex-direction: column; gap: 2px; }
.cl-item { width: 100%; display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 14px; text-align: start; min-height: 64px; cursor: pointer; transition: background .15s; }
.cl-item:hover { background: var(--surface-2); }
.cl-item.active { background: color-mix(in srgb, var(--blue) 12%, transparent); }
.cl-av { position: relative; flex: none; width: 44px; height: 44px; }
.cl-face { width: 100%; height: 100%; border-radius: 999px; overflow: hidden; display: grid; place-items: center; background: var(--blue-soft); color: var(--blue-ink); }
.cl-dot { position: absolute; inset-block-end: 1px; inset-inline-start: 1px; width: 12px; height: 12px; border-radius: 999px; background: var(--green); border: 2px solid var(--surface); }
.cl-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cl-top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.cl-top b { color: var(--ink); font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-top time { flex: none; font-size: 12px; color: var(--ink-3); }
.cl-item.unread .cl-top time { color: var(--blue); font-weight: 600; }
.cl-sub { font-size: 12px; color: var(--ink-3); }
.cl-last { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.cl-text { font-size: 13px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-tick { width: 14px; height: 14px; vertical-align: -2px; margin-inline-end: 3px; color: var(--ink-3); }
.cl-tick.read { color: var(--blue); }
.cl-item.unread .cl-text { color: var(--ink); font-weight: 500; }
.cl-badge { flex: none; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--blue); color: #fff; font-size: 12px; font-weight: 600; display: grid; place-items: center; }
</style>
