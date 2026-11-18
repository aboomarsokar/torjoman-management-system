<script setup lang="ts">
/**
 * محاضراتُ المقرّر ومقاطعُه سطراً سطراً (طلب المستخدم 2026-11-11) — في بطاقة المقرّر للعاملين وبطاقة الطالب:
 * الاسمُ وصاحبُه ومدّتُه، والسطرُ رابطٌ يفتح يوتيوب في نافذةٍ جديدة؛ وما لم يُضف رابطُه بعدُ نصٌّ بلا رابط.
 * و`highlight` يضع فوقها شريطاً لافتاً «في هذا المقرّر محاضرتان مرئيتان» كي لا تفوت الطالبَ (2026-11-18).
 */
import { formatDuration, videosPhrase, type ReadingItem } from '~/utils/reading'

interface Props {
  /** المرئيّاتُ مرتّبة (`unitVideos`). */
  items: ReadingItem[]
  /** شريطٌ لافت فوق القائمة (بطاقة الطالب). */
  highlight?: boolean
}
const props = defineProps<Props>()
const phrase = computed(() => videosPhrase(props.items))

const meta = (i: ReadingItem) => [i.speaker, formatDuration(i.durationSeconds)].filter(Boolean).join(' · ')
</script>

<template>
  <p
    v-if="highlight && items.length"
    class="uv-banner"
  >
    <UIcon
      name="i-lucide-circle-play"
      class="size-5 uv-banner-ic"
    />
    <span>في هذا المقرّر <b>{{ phrase }}</b> مع القراءة — شاهدها من هنا</span>
  </p>
  <ul
    v-if="items.length"
    class="uv"
    :class="{ boxed: highlight }"
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
.uv-banner { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; padding: 9px 12px; border-radius: 12px 12px 0 0; background: var(--green-soft); color: var(--green-ink); font-size: 14px; font-weight: 500; line-height: 1.5; }
.uv-banner b { font-weight: 700; }
.uv-banner-ic { flex: none; }
.uv.boxed { margin-top: 4px; padding: 4px 12px 6px; border: 1px solid color-mix(in srgb, var(--green) 35%, var(--line)); border-top: none; border-radius: 0 0 12px 12px; }
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
