<script setup lang="ts">
/**
 * زرُّ الوضع (طلب المستخدم 2026-10-22): كلُّ ضغطةٍ تنقل إلى الحالة التالية — فاتح ← ليلي ← حسب النظام ← فاتح —
 * بلا قائمة خيارات. الأيقونةُ أيقونةُ الحالة الحالية، والتلميحُ يسمّيها ويسمّي التالية. بشكل زرّ الجرس ليتجاورا.
 * الاختيارُ `colorMode.preference` (يُحفظ في المتصفّح).
 */
const colorMode = useColorMode()

const MODES = [
  { value: 'light', label: 'الوضع الفاتح', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'الوضع الليلي', icon: 'i-lucide-moon-star' },
  { value: 'system', label: 'حسب النظام', icon: 'i-lucide-monitor' }
] as const

const index = computed(() => Math.max(0, MODES.findIndex(m => m.value === colorMode.preference)))
const current = computed(() => MODES[index.value]!)
const next = computed(() => MODES[(index.value + 1) % MODES.length]!)

function cycleMode() {
  colorMode.preference = next.value.value
}
</script>

<template>
  <button
    type="button"
    class="theme-btn"
    :title="`${current.label} — اضغط لـ«${next.label}»`"
    :aria-label="`الوضع: ${current.label}. اضغط للتبديل إلى ${next.label}`"
    @click="cycleMode"
  >
    <ClientOnly>
      <UIcon
        :name="current.icon"
        class="size-5"
      />
      <template #fallback>
        <UIcon
          name="i-lucide-sun"
          class="size-5"
        />
      </template>
    </ClientOnly>
  </button>
</template>

<style scoped>
/* بشكل زرّ الجرس (`.top-icon`) كي يتجاورا متطابقَين */
.theme-btn { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: color .2s, border-color .2s; }
.theme-btn:hover { color: var(--ink); border-color: var(--blue); }
.theme-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
</style>
