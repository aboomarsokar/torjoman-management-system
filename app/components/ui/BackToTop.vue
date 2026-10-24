<script setup lang="ts">
/**
 * زرُّ «إلى الأعلى» العائم (طلب المستخدم 2026-10-22) — في هيكل لوحة التحكم مرّةً واحدة فيعمّ الشاشات كلَّها.
 * يظهر بعد نزولٍ يتجاوز طولَ الشاشة ويختفي في الأعلى، وفي نهاية السطر (اليسار) بعيداً عن الأزرار الرئيسية.
 * المُمرَّرُ النافذةُ عادةً و`.content` (`container`) أحياناً، فيُقرأ الاثنان ويُصعَدان معاً.
 * ويرتفع فوق شريطٍ ثابتٍ في أسفل الصفحة (`data-float-above`، كشريط حفظ الحضور) ما دام ملتصقاً بالقاع.
 */
const props = defineProps<{ container?: HTMLElement | null }>()

const visible = ref(false)
const lift = ref(0)
let frame = 0

function measure() {
  frame = 0
  const offset = Math.max(window.scrollY, props.container?.scrollTop ?? 0)
  visible.value = offset > window.innerHeight
  const bar = document.querySelector<HTMLElement>('[data-float-above]')?.getBoundingClientRect()
  lift.value = bar && bar.top < window.innerHeight && bar.bottom > window.innerHeight - 40
    ? window.innerHeight - bar.top + 8
    : 0
}
/** قياسٌ واحدٌ لكلّ إطار مهما كثرت أحداث التمرير. */
function schedule() {
  if (!frame) frame = requestAnimationFrame(measure)
}

onMounted(() => {
  // `capture`: تمريرُ `.content` لا يصعد إلى النافذة إلا التقاطاً
  window.addEventListener('scroll', schedule, { passive: true, capture: true })
  window.addEventListener('resize', schedule, { passive: true })
  measure()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule, { capture: true })
  window.removeEventListener('resize', schedule)
  if (frame) cancelAnimationFrame(frame)
})
const route = useRoute()
watch(() => route.fullPath, () => nextTick(measure))

function toTop() {
  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  props.container?.scrollTo({ top: 0, behavior })
  window.scrollTo({ top: 0, behavior })
}
</script>

<template>
  <Transition name="ttop">
    <button
      v-if="visible"
      type="button"
      class="ttop"
      :style="lift ? { '--ttop-lift': `${lift}px` } : undefined"
      aria-label="إلى أعلى الصفحة"
      title="إلى الأعلى"
      @click="toTop"
    >
      <UIcon
        name="i-lucide-arrow-up"
        class="size-5"
      />
    </button>
  </Transition>
</template>

<style scoped>
/* تحت النوافذ المنبثقة والقائمة الجانبية على الجوال (50–60) وفوق المحتوى */
.ttop { position: fixed; inset-inline-end: 20px; bottom: calc(20px + env(safe-area-inset-bottom) + var(--ttop-lift, 0px)); z-index: 40; width: 44px; height: 44px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); box-shadow: var(--shadow-lg); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: color .2s, border-color .2s, bottom .2s; }
.ttop:hover { color: var(--ink); border-color: var(--blue); }
.ttop:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
@media (max-width: 620px) {
  .ttop { inset-inline-end: 16px; bottom: calc(16px + env(safe-area-inset-bottom) + var(--ttop-lift, 0px)); }
}

.ttop-enter-active, .ttop-leave-active { transition: opacity .2s, transform .2s; }
.ttop-enter-from, .ttop-leave-to { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) {
  .ttop, .ttop-enter-active, .ttop-leave-active { transition: none; }
}
</style>
