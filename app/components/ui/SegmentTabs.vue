<script setup lang="ts" generic="K extends string">
/**
 * تبويباتٌ مقطّعة (مستخرَجةٌ من تبويبات صفحة الطالب 2026-10-25 لتُشارَك): بعرض الشاشة على الجوال وبقدر محتواها
 * على الحاسوب. كلُّ تبويبٍ `tab-<key>` ويضبط `panel-<key>` — فلوحةُ المحتوى تحمل ذلك المعرّف وrole="tabpanel".
 * `count` اختياريّ: عددٌ بجانب التسمية.
 */
export interface SegmentTab<T extends string = string> {
  key: T
  label: string
  icon: string
  count?: number
}

defineProps<{ tabs: SegmentTab<K>[], label: string }>()
const tab = defineModel<K>({ required: true })
</script>

<template>
  <div
    class="tabs"
    role="tablist"
    :aria-label="label"
  >
    <button
      v-for="t in tabs"
      :id="`tab-${t.key}`"
      :key="t.key"
      type="button"
      role="tab"
      class="tab"
      :class="{ active: tab === t.key }"
      :aria-selected="tab === t.key"
      :aria-controls="`panel-${t.key}`"
      @click="tab = t.key"
    >
      <UIcon
        :name="t.icon"
        class="size-[18px]"
      />
      {{ t.label }}
      <span
        v-if="t.count !== undefined"
        class="tab-n"
      >{{ t.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.tabs { display: inline-flex; gap: 4px; padding: 5px; margin-bottom: 20px; background: var(--surface-3); border: 1px solid var(--line); border-radius: 16px; max-width: 100%; }
.tab { flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px; border: none; border-radius: 12px; background: transparent; color: var(--ink-2); font: inherit; font-size: 14.5px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
.tab:hover { color: var(--ink); }
.tab.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow); }
.tab:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.tab-n { min-width: 24px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 12.5px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.tab.active .tab-n { background: var(--navy); color: #fff; }

@media (max-width: 640px) {
  .tabs { display: flex; width: 100%; }
  .tab { padding: 0 8px; gap: 6px; font-size: 14px; }
}
</style>
