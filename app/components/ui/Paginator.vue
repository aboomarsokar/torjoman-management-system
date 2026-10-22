<script setup lang="ts">
/** شريط ترقيم الصفحات (§4.16ج) — «عرض س–ص من الإجمالي» + سابق/تالي. يختفي عند صفحة واحدة. */
const props = defineProps<{ page: number, pageCount: number, total: number, pageSize: number }>()
const emit = defineEmits<{ 'update:page': [number] }>()

const from = computed(() => props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1)
const to = computed(() => Math.min(props.page * props.pageSize, props.total))

const root = ref<HTMLElement>()
/**
 * الصفحةُ الجديدة تُعرض من أوّلها (طلب المستخدم 2026-10-22): يصعد أقربُ سلفٍ يُمرَّر — `.content` في لوحة التحكم
 * لا النافذة، أو جسمُ نافذةٍ منبثقة — وإلا فالنافذة. بلا حركةٍ لمن طلب تقليلها.
 */
function scrollToStart() {
  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  for (let el = root.value?.parentElement; el && el !== document.body; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: 0, behavior })
      return
    }
  }
  window.scrollTo({ top: 0, behavior })
}

function go(p: number) {
  if (p < 1 || p > props.pageCount || p === props.page) return
  emit('update:page', p)
  scrollToStart()
}
// أرقام صفحات مختصرة حول الصفحة الحالية
const pages = computed(() => {
  const out: number[] = []
  const start = Math.max(1, props.page - 1)
  const end = Math.min(props.pageCount, start + 2)
  for (let i = start; i <= end; i++) out.push(i)
  return out
})
</script>

<template>
  <div
    v-if="pageCount > 1"
    ref="root"
    class="pg"
  >
    <span class="pg-info">عرض {{ from }}–{{ to }} من {{ total }}</span>
    <div class="pg-btns">
      <button
        class="pg-b"
        :disabled="page <= 1"
        aria-label="السابق"
        @click="go(page - 1)"
      >
        <UIcon
          name="i-lucide-chevron-right"
          class="size-4"
        />
      </button>
      <button
        v-if="pages[0]! > 1"
        class="pg-b"
        @click="go(1)"
      >
        1
      </button>
      <span
        v-if="pages[0]! > 2"
        class="pg-dots"
      >…</span>
      <button
        v-for="p in pages"
        :key="p"
        class="pg-b"
        :class="{ active: p === page }"
        @click="go(p)"
      >
        {{ p }}
      </button>
      <span
        v-if="pages[pages.length - 1]! < pageCount - 1"
        class="pg-dots"
      >…</span>
      <button
        v-if="pages[pages.length - 1]! < pageCount"
        class="pg-b"
        @click="go(pageCount)"
      >
        {{ pageCount }}
      </button>
      <button
        class="pg-b"
        :disabled="page >= pageCount"
        aria-label="التالي"
        @click="go(page + 1)"
      >
        <UIcon
          name="i-lucide-chevron-left"
          class="size-4"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pg { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-top: 16px; }
.pg-info { font-size: 13.5px; color: var(--ink-3); }
.pg-btns { display: flex; align-items: center; gap: 6px; }
.pg-b { min-width: 36px; height: 36px; padding: 0 9px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-2); font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all .15s; }
.pg-b:hover:not(:disabled) { border-color: var(--blue); color: var(--ink); }
.pg-b.active { background: var(--blue); border-color: var(--blue); color: #fff; }
.pg-b:disabled { opacity: .4; cursor: not-allowed; }
.pg-dots { color: var(--ink-3); padding: 0 2px; }
</style>
