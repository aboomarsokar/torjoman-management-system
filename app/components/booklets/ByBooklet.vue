<script setup lang="ts">
/**
 * أرشيفُ الملازم حسب الملزمة: شبكةُ الملازم الخمسَ عشرة بمجموع نسخ كلٍّ منها وعدد الحلقات التي استلمتها.
 * الملزمةُ التي لم تُوزَّع بعد بلونٍ أخفت.
 */
import type { BookletTotal } from '~/utils/booklets'

defineProps<{ rows: BookletTotal[] }>()
</script>

<template>
  <ul class="grid">
    <li
      v-for="b in rows"
      :key="b.no"
      class="tile"
      :class="{ none: !b.copies }"
    >
      <span class="no">الملزمة <span class="num">{{ b.no }}</span></span>
      <span class="label">{{ b.label }}</span>
      <strong class="num copies">{{ b.copies }}</strong>
      <span class="meta">{{ b.copies ? `نسخة · ${b.halaqat} حلقة` : 'لم تُوزَّع' }}</span>
    </li>
  </ul>
</template>

<style scoped>
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.tile { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.tile.none { box-shadow: none; background: var(--surface-2); }
.no { font-size: 12px; color: var(--ink-3); }
.label { font-weight: 600; color: var(--ink); font-size: 15px; }
.copies { font-size: 26px; font-weight: 600; color: var(--navy); margin-top: 6px; line-height: 1.1; }
.none .copies { color: var(--ink-3); }
.meta { font-size: 12.5px; color: var(--ink-3); }
.num { font-variant-numeric: tabular-nums; }
</style>
