<script setup lang="ts">
/**
 * جرسُ الشريط العلوي بقسمين: «بانتظارك» (طوابيرُ محسوبة من useNotifications)
 * و«الإشعارات» (أخبارٌ مخزّنة من useInbox). العدّاد = غيرُ المقروء + ما ينتظر.
 * الضغط على خبرٍ يعلّمه مقروءاً وينتقل إلى رابطه.
 */
import { notificationIcon } from '~/constants/notifications'
import { relativeTimeAr, type InboxRow } from '~/composables/useInbox'

const { count: queueCount, items: queueItems } = useNotifications()
const { rows, unread, markRead } = useInbox()

const badge = computed(() => queueCount.value + unread.value)
const now = ref(new Date())

async function openRow(row: InboxRow) {
  if (!row.read_at) await markRead([row.id])
  if (row.link) await navigateTo(row.link)
}
</script>

<template>
  <UPopover
    :ui="{ content: 'w-96 max-w-[94vw]' }"
    @update:open="(o: boolean) => { if (o) now = new Date() }"
  >
    <div class="bell-wrap">
      <button
        class="top-icon"
        aria-label="الإشعارات"
      >
        <UIcon
          name="i-lucide-bell"
          class="size-5"
        />
      </button>
      <span
        v-if="badge > 0"
        class="bell-badge"
      >{{ badge > 99 ? '99+' : badge }}</span>
    </div>
    <template #content>
      <div class="notif">
        <template v-if="queueItems.length">
          <div class="notif-head">
            بانتظارك
          </div>
          <NuxtLink
            v-for="n in queueItems"
            :key="n.id"
            :to="n.to"
            class="notif-item"
          >
            <UIcon
              :name="n.icon"
              class="size-[18px]"
            />
            <div class="notif-text">
              <div class="notif-label">
                {{ n.label }}
              </div>
              <div
                v-if="n.sub"
                class="notif-sub"
              >
                {{ n.sub }}
              </div>
            </div>
          </NuxtLink>
        </template>

        <div class="notif-head notif-head-row">
          <span>الإشعارات</span>
          <button
            v-if="unread > 0"
            class="notif-markall"
            @click="markRead(null)"
          >
            تعليم الكل مقروءاً
          </button>
        </div>
        <div
          v-if="!rows.length"
          class="notif-empty"
        >
          <UIcon
            name="i-lucide-bell-off"
            class="size-6"
          />
          لا إشعارات بعد
        </div>
        <div class="notif-list">
          <button
            v-for="r in rows"
            :key="r.id"
            class="notif-item"
            :class="{ 'is-unread': !r.read_at }"
            @click="openRow(r)"
          >
            <UIcon
              :name="notificationIcon(r.kind)"
              class="size-[18px]"
            />
            <div class="notif-text">
              <div class="notif-label">
                {{ r.title }}
              </div>
              <div
                v-if="r.body"
                class="notif-sub"
              >
                {{ r.body }}
              </div>
              <div class="notif-time">
                {{ relativeTimeAr(r.created_at, now) }}
              </div>
            </div>
            <span
              v-if="!r.read_at"
              class="notif-dot"
              aria-label="غير مقروء"
            />
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.bell-wrap { position: relative; display: inline-flex; }
.bell-badge { position: absolute; top: -7px; inset-inline-end: -7px; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--err); color: #fff; font-size: 13px; font-weight: 800; line-height: 22px; text-align: center; box-shadow: 0 0 0 2px var(--surface); font-variant-numeric: tabular-nums; pointer-events: none; }
.notif { padding: 6px; }
.notif-head { font-size: 14px; font-weight: 700; color: var(--ink); padding: 8px 10px 10px; border-bottom: 1px solid var(--line); }
.notif-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.notif-markall { font-size: 12.5px; font-weight: 600; color: var(--ink-2); min-height: 44px; padding: 0 6px; }
.notif-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; color: var(--ink-3); font-size: 14px; }
.notif-list { max-height: 60vh; overflow-y: auto; }
.notif-item { display: flex; width: 100%; text-align: start; align-items: flex-start; gap: 10px; padding: 11px 10px; border-radius: 11px; color: var(--ink-2); transition: background .15s; }
.notif-item:hover { background: var(--surface-2); }
.notif-item.is-unread { background: var(--surface-2); }
.notif-text { min-width: 0; flex: 1; }
.notif-label { font-size: 14px; font-weight: 600; color: var(--ink); }
.notif-sub { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
.notif-time { font-size: 12px; color: var(--ink-3); margin-top: 4px; font-variant-numeric: tabular-nums; }
.notif-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--err); margin-top: 6px; flex: none; }
</style>
