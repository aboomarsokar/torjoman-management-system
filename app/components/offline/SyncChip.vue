<script setup lang="ts">
/**
 * حالةُ رفع الحضور في رأس شاشة المعلّم بلا إنترنت (البند 14): متّصلٌ وكلُّه مرفوع · بلا اتصال · ينتظر · يُرفع · مرفوضٌ يحتاج مراجعة.
 * زرٌّ يرفع الآن حين يكون في الصندوق ما ينتظر والاتصالُ قائم.
 */
const props = defineProps<{ text: string, online: boolean, pending: number, rejected: number, syncing: boolean }>()
const emit = defineEmits<{ sync: [] }>()

const tone = computed(() => {
  if (props.rejected) return { cls: 'bad', icon: 'i-lucide-circle-alert' }
  if (props.syncing) return { cls: 'busy', icon: 'i-lucide-loader-circle' }
  if (!props.online) return { cls: 'off', icon: 'i-lucide-wifi-off' }
  if (props.pending) return { cls: 'wait', icon: 'i-lucide-cloud-upload' }
  return { cls: 'ok', icon: 'i-lucide-cloud-check' }
})
const canSync = computed(() => props.online && props.pending > 0 && !props.syncing)
</script>

<template>
  <div
    class="chip"
    :class="tone.cls"
    role="status"
    aria-live="polite"
  >
    <UIcon
      :name="tone.icon"
      class="size-5 shrink-0"
      :class="{ 'animate-spin': syncing }"
    />
    <span>{{ text }}</span>
    <button
      v-if="canSync"
      type="button"
      class="now"
      @click="emit('sync')"
    >
      ارفع الآن
    </button>
  </div>
</template>

<style scoped>
.chip { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--line); font-size: 14.5px; font-weight: 600; line-height: 1.6; }
.chip > span { flex: 1 1 200px; }
.ok { background: var(--green-soft); color: var(--green-ink); }
.wait, .busy { background: var(--blue-soft); color: var(--blue-ink); }
.off { background: var(--surface-2); color: var(--ink-2); }
.bad { background: color-mix(in srgb, var(--err) 10%, var(--surface)); color: var(--err); border-color: color-mix(in srgb, var(--err) 35%, var(--line)); }
.now { border: none; background: none; padding: 0; min-height: 44px; font: inherit; font-weight: 700; color: inherit; text-decoration: underline; cursor: pointer; }
</style>
