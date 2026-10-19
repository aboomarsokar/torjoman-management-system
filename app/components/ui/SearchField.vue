<script setup lang="ts">
/**
 * حقلُ البحث الموحّد (الشكل ٣ — اختيار المستخدم 2026-10-19): حبّةٌ مستديرة بارتفاع 48px، أيقونتُها في دائرةٍ
 * ملوّنة، ومتى كُتب شيءٌ ظهر عددُ النتائج («3 من 24») وزرٌّ يمسح البحث بلمسة (44px للّمس).
 */
interface Props {
  placeholder?: string
  /** عددُ ما يطابق البحث — يظهر مع `total` متى كان في الحقل نصّ. */
  shown?: number
  total?: number
}
const props = defineProps<Props>()
const model = defineModel<string>({ default: '' })
const hasQuery = computed(() => model.value.trim().length > 0)
const countText = computed(() => (hasQuery.value && props.shown !== undefined && props.total !== undefined)
  ? `${props.shown} من ${props.total}`
  : '')
const input = ref<{ inputRef?: HTMLInputElement } | null>(null)
function clear() {
  model.value = ''
  input.value?.inputRef?.focus()
}
</script>

<template>
  <!-- جذرٌ عاديّ يستقبل صنفَ الأب وعرضَه (أنماطُ الأب المحصورة لا تبلغ جذرَ مكوّنٍ داخل مكوّن) -->
  <div class="sf">
    <UInput
      ref="input"
      v-model="model"
      type="search"
      :placeholder="placeholder"
      size="xl"
      class="w-full"
      :ui="{
        root: 'search-field',
        base: 'rounded-full min-h-12 ps-14 pe-3 bg-(--surface) ring-(--line-2) [&::-webkit-search-cancel-button]:hidden',
        leading: 'ps-1.5',
        trailing: 'pe-1.5 gap-1'
      }"
    >
      <template #leading>
        <span class="sf-ico">
          <UIcon
            name="i-lucide-search"
            class="size-[18px]"
          />
        </span>
      </template>
      <template
        v-if="hasQuery"
        #trailing
      >
        <span
          v-if="countText"
          class="sf-count"
          aria-live="polite"
        >{{ countText }}</span>
        <button
          type="button"
          class="sf-clear"
          aria-label="مسح البحث"
          @click="clear"
        >
          <UIcon
            name="i-lucide-x"
            class="size-4"
          />
        </button>
      </template>
    </UInput>
  </div>
</template>

<style scoped>
.sf { display: flex; min-width: 0; }
.sf-ico { width: 36px; height: 36px; border-radius: 999px; background: var(--blue-soft); color: var(--blue); display: flex; align-items: center; justify-content: center; }
.sf-count { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; font-variant-numeric: tabular-nums; padding-inline: 4px; }
.sf-clear { width: 44px; height: 44px; margin-block: -4px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: var(--ink-3); cursor: pointer; transition: background .15s, color .15s; }
.sf-clear:hover { background: var(--surface-2); color: var(--ink); }
</style>
