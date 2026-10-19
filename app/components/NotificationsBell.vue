<script setup lang="ts">
/**
 * جرسُ الشريط العلوي بقسمين: «بانتظارك» (طوابيرُ محسوبة من useNotifications)
 * و«الإشعارات» (أخبارٌ مخزّنة من useInbox). العدّاد = غيرُ المقروء + ما ينتظر بعد إسقاط ما يمثّله خبرٌ غيرُ مقروء.
 * الضغطُ على أيّ بندٍ يُغلق القائمة فوراً وينتقل إلى رابطه (طلب المستخدم 2026-10-19)، والخبرُ يُعلَّم مقروءاً
 * في الخلفية — كانت القائمةُ تبقى مفتوحةً فوق الصفحة الجديدة، والانتقالُ ينتظر التعليم.
 * عند وصول إشعارٍ جديد يهتزّ الجرس ويرنّ (صوتٌ مولَّد بلا ملفّ)؛ ولا حركة مع prefers-reduced-motion.
 */
import { notificationIcon } from '~/constants/notifications'
import { newUnreadIds, pendingQueue, relativeTimeAr, type InboxRow } from '~/composables/useInbox'

/** مدّةُ بقاء صنف الاهتزاز: ثلاثُ دوراتٍ بثانيةٍ لكلٍّ منها */
const RING_MS = 3100

const { items: queueItems } = useNotifications()
const { rows, unread, loaded, markRead } = useInbox()
const { play: chime } = useNotificationChime()

// الخبرُ غيرُ المقروء يمثّل بندَه في الطابور: يُخفى البندُ ولا يُعدّ حتى يُقرأ الخبر
const queue = computed(() => pendingQueue(queueItems.value, rows.value))
const badge = computed(() => queue.value.length + unread.value)
const bellLabel = computed(() =>
  badge.value > 0 ? `الإشعارات — ${badge.value} غير مقروءة` : 'الإشعارات'
)

const isRinging = ref(false)
const bellButton = ref<HTMLButtonElement | null>(null)
/** معرّفاتُ ما رُئي من الإشعارات؛ null قبل أوّل قراءةٍ ناجحة وبعد تبدّل المستخدم */
let seenIds: Set<string> | null = null
let ringTimer: ReturnType<typeof setTimeout> | null = null

async function ring() {
  chime()
  // يُزال الصنفُ ويُرسم، ثم تُقرأ مقاييسُ العنصر لإجبار إعادة الحساب، ثم يُعاد الصنف:
  // بلا ذلك قد يدمج المتصفّحُ التغييرين فلا تُعاد الحركةُ لخبرٍ ثانٍ
  isRinging.value = false
  await nextTick()
  void bellButton.value?.offsetWidth
  isRinging.value = true
  if (ringTimer) clearTimeout(ringTimer)
  ringTimer = setTimeout(() => {
    isRinging.value = false
    ringTimer = null
  }, RING_MS)
}

// يرنّ عند ظهور إشعارٍ غير مقروء لم يُرَ من قبل (بالمعرّف لا بفرق العدّ)، ومرّةً عند أوّل قراءةٍ فيها غير مقروء.
// قبل أوّل قراءةٍ ناجحة (أو بعد تبدّل المستخدم) لا يُحتسب شيء ويعود الأساسُ null.
watch([rows, loaded], ([list, isLoaded]) => {
  if (!isLoaded) {
    seenIds = null
    return
  }
  const decision = newUnreadIds(seenIds, list)
  seenIds = decision.seen
  if (decision.fresh.length) void ring()
})

onUnmounted(() => {
  if (ringTimer) clearTimeout(ringTimer)
})
const now = ref(new Date())
const open = ref(false)
watch(open, (o) => {
  if (o) now.value = new Date()
})

async function openRow(row: InboxRow) {
  open.value = false
  if (!row.read_at) void markRead([row.id])
  if (row.link) await navigateTo(row.link)
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :ui="{ content: 'w-96 max-w-[94vw]' }"
  >
    <div class="bell-wrap">
      <button
        ref="bellButton"
        type="button"
        class="top-icon"
        :aria-label="bellLabel"
      >
        <UIcon
          name="i-lucide-bell"
          class="size-5"
          :class="{ 'bell-ring': isRinging }"
        />
      </button>
      <span
        v-if="badge > 0"
        class="bell-badge"
        :class="{ 'bell-count-pop': isRinging }"
      >{{ badge > 99 ? '99+' : badge }}</span>
    </div>
    <template #content>
      <div class="notif">
        <template v-if="queue.length">
          <div class="notif-head">
            بانتظارك
          </div>
          <NuxtLink
            v-for="n in queue"
            :key="n.id"
            :to="n.to"
            class="notif-item"
            @click="open = false"
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
            type="button"
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
            type="button"
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
              role="img"
              aria-label="غير مقروء"
            />
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.top-icon { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s; }
.top-icon:hover { color: var(--ink); border-color: var(--blue); }
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
.notif-item.is-unread:hover { background: var(--line); }
.notif-text { min-width: 0; flex: 1; }
.notif-label { font-size: 14px; font-weight: 600; color: var(--ink); }
.notif-sub { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
.notif-time { font-size: 12px; color: var(--ink-3); margin-top: 4px; font-variant-numeric: tabular-nums; }
.notif-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--err); margin-top: 6px; flex: none; }
.bell-ring { transform-origin: top center; animation: bell-ring 1s ease-in-out 3; }
.bell-count-pop { animation: bell-count-pop 1s ease-in-out 3; }
@keyframes bell-ring {
  0%, 100% { transform: rotate(0) scale(1); }
  6% { transform: rotate(-22deg) scale(1.14); }
  16% { transform: rotate(20deg) scale(1.12); }
  27% { transform: rotate(-16deg) scale(1.09); }
  38% { transform: rotate(13deg) scale(1.06); }
  49% { transform: rotate(-10deg) scale(1.04); }
  60% { transform: rotate(7deg) scale(1.02); }
  71% { transform: rotate(-4deg) scale(1.01); }
  82% { transform: rotate(2deg) scale(1); }
  91% { transform: rotate(-1deg) scale(1); }
}
@keyframes bell-count-pop {
  0%, 100% { transform: scale(1); }
  18% { transform: scale(1.45); }
  45% { transform: scale(.95); }
  70% { transform: scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
  .bell-ring, .bell-count-pop { animation: none; }
}
</style>
