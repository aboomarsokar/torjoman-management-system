<script setup lang="ts">
/**
 * ما رفضته القاعدةُ من صندوق الجهاز (شهرٌ اعتُمد أو أُرسل في أثناء الانقطاع، جمعة…) — البند 14: أيامُ الحضور
 * وسجلّاتُ الإنجاز القرآنيّ. لا تُعاد تلقائياً لأنّ الإعادةَ لا تُصلحها: المعلّمُ يعيد المحاولةَ بعد أن تفتح الإدارةُ
 * الشهر، أو يتركها فيعود ما في القاعدة.
 */
defineProps<{
  title: string
  /** `label` ما رُفض (يومٌ أو اسمُ طالب)، و`error` سببُ الرفض من القاعدة. */
  entries: { key: string, label: string, error?: string }[]
}>()
const emit = defineEmits<{ retry: [key: string], discard: [key: string] }>()
</script>

<template>
  <section
    class="rej"
    :aria-label="title"
  >
    <h2>{{ title }}</h2>
    <ul>
      <li
        v-for="e in entries"
        :key="e.key"
      >
        <div class="what">
          <b><bdi>{{ e.label }}</bdi></b>
          <span>{{ e.error || 'رُفض الحفظ.' }}</span>
        </div>
        <div class="acts">
          <UButton
            label="أعد المحاولة"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            :ui="{ base: 'rounded-[11px] min-h-11' }"
            @click="emit('retry', e.key)"
          />
          <UButton
            label="اتركه"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[11px] min-h-11' }"
            @click="emit('discard', e.key)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rej { padding: 16px 18px; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--err) 35%, var(--line)); background: var(--surface); }
.rej h2 { margin: 0 0 8px; font-size: 15.5px; font-weight: 700; color: var(--err); }
.rej ul { list-style: none; margin: 0; padding: 0; }
.rej li { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 0; }
.rej li + li { border-top: 1px solid var(--line); }
.what { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.what b { color: var(--ink); font-variant-numeric: tabular-nums; }
.what span { font-size: 13.5px; color: var(--ink-2); }
.acts { display: flex; gap: 6px; }
</style>
