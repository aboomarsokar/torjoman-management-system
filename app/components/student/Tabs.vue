<script setup lang="ts">
/**
 * تبويباتُ صفحة الطالب — «لوحة التحكم» و«رحلتي/رحلته» و«بياناتي/بياناته» — مشتركةٌ بين «صفحتي»
 * وملفّ الطالب عند العاملين. مقطّعٌ واحد: بعرض الشاشة على الجوال، وبقدر محتواه على الحاسوب.
 * التبويبُ في الرابط (`useStudentTab`)، والصياغةُ بضمير المتكلّم للطالب وبالغائب للعامل.
 */
import type { StudentTab } from '~/composables/useStudentTab'

interface Props {
  /** الطالبُ نفسه (رحلتي/بياناتي) أم العامل (رحلته/بياناته). */
  self: boolean
}

const props = defineProps<Props>()
const tab = defineModel<StudentTab>({ required: true })

const tabs = computed<{ key: StudentTab, label: string, icon: string }[]>(() => [
  { key: 'dashboard', label: 'لوحة التحكم', icon: 'i-lucide-layout-dashboard' },
  { key: 'journey', label: props.self ? 'رحلتي' : 'رحلته', icon: 'i-lucide-route' },
  { key: 'data', label: props.self ? 'بياناتي' : 'بياناته', icon: 'i-lucide-id-card' }
])
</script>

<template>
  <div
    class="tabs"
    role="tablist"
    aria-label="أقسام صفحة الطالب"
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
    </button>
  </div>
</template>

<style scoped>
.tabs { display: inline-flex; gap: 4px; padding: 5px; margin-bottom: 20px; background: var(--surface-3); border: 1px solid var(--line); border-radius: 16px; max-width: 100%; }
.tab { flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px; border: none; border-radius: 12px; background: transparent; color: var(--ink-2); font: inherit; font-size: 14.5px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
.tab:hover { color: var(--ink); }
.tab.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow); }
.tab:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

@media (max-width: 640px) {
  .tabs { display: flex; width: 100%; }
  .tab { padding: 0 8px; gap: 6px; font-size: 14px; }
}
</style>
