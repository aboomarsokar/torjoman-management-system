<script setup lang="ts">
/**
 * محاضراتُ المقرّر ومقاطعُه سطراً سطراً (طلب المستخدم 2026-11-11) — في بطاقة المقرّر للعاملين وبطاقة الطالب:
 * الاسمُ وصاحبُه ومدّتُه، والسطرُ رابطٌ يفتح يوتيوب في نافذةٍ جديدة؛ وما لم يُضف رابطُه بعدُ نصٌّ بلا رابط.
 */
import { formatDuration, type ReadingItem } from '~/utils/reading'

interface Props {
  /** المرئيّاتُ مرتّبة (`unitVideos`). */
  items: ReadingItem[]
}
defineProps<Props>()

const meta = (i: ReadingItem) => [i.speaker, formatDuration(i.durationSeconds)].filter(Boolean).join(' · ')
</script>

<template>
  <ul
    v-if="items.length"
    class="uv"
    aria-label="محاضرات المقرّر"
  >
    <li
      v-for="it in items"
      :key="`${it.week}-${it.sort_order}`"
    >
      <component
        :is="it.url ? 'a' : 'span'"
        :href="it.url ?? undefined"
        :target="it.url ? '_blank' : undefined"
        :rel="it.url ? 'noopener' : undefined"
        class="uv-row"
        :class="{ link: !!it.url }"
      >
        <UIcon
          name="i-lucide-circle-play"
          class="size-4 uv-ic"
        />
        <span class="uv-txt">
          <span class="uv-title">{{ it.title }}</span>
          <small v-if="meta(it)">{{ meta(it) }}</small>
        </span>
        <span
          v-if="!it.url"
          class="uv-soon"
        >الرابطُ قريباً</span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.uv { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.uv-row { display: flex; align-items: flex-start; gap: 8px; min-height: 32px; padding: 4px 6px; margin-inline: -6px; border-radius: 8px; color: var(--ink-2); text-decoration: none; }
.uv-row.link { color: var(--blue-ink); }
.uv-row.link:hover { background: var(--blue-soft); }
.uv-row.link:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
.uv-ic { flex: none; margin-top: 3px; }
.uv-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.45; }
.uv-title { font-size: 14px; font-weight: 600; }
.uv-txt small { font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.uv-soon { flex: none; font-size: 12px; color: var(--ink-3); margin-top: 2px; }
</style>
