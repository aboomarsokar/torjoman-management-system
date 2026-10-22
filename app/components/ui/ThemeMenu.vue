<script setup lang="ts">
/**
 * اختيارُ الوضع (طلب المستخدم 2026-10-22): فاتح · ليلي · حسب النظام — قائمةٌ صغيرة بزرٍّ بشكل زرّ الجرس، كان زرّاً
 * يقلب بين اثنين في أسفل القائمة الجانبية. الاختيارُ `colorMode.preference` (يُحفظ في المتصفّح)، والأيقونةُ أيقونتُه.
 */
const colorMode = useColorMode()

const OPTIONS = [
  { value: 'light', label: 'الوضع الفاتح', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'الوضع الليلي', icon: 'i-lucide-moon-star' },
  { value: 'system', label: 'حسب النظام', icon: 'i-lucide-monitor' }
] as const

const current = computed(() => OPTIONS.find(o => o.value === colorMode.preference) ?? OPTIONS[2])
const items = computed(() => [OPTIONS.map(o => ({
  label: o.label,
  icon: o.icon,
  type: 'checkbox' as const,
  checked: colorMode.preference === o.value,
  onSelect: () => { colorMode.preference = o.value }
}))])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end' }"
    :ui="{ content: 'min-w-44' }"
  >
    <button
      type="button"
      class="theme-btn"
      :aria-label="`الوضع: ${current.label} — غيّره`"
    >
      <ClientOnly>
        <UIcon
          :name="current.icon"
          class="size-5"
        />
        <template #fallback>
          <UIcon
            name="i-lucide-sun-moon"
            class="size-5"
          />
        </template>
      </ClientOnly>
    </button>
  </UDropdownMenu>
</template>

<style scoped>
/* بشكل زرّ الجرس (`.top-icon`) كي يتجاورا متطابقَين */
.theme-btn { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: color .2s, border-color .2s; }
.theme-btn:hover { color: var(--ink); border-color: var(--blue); }
.theme-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
</style>
