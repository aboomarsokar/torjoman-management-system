<script setup lang="ts">
/**
 * عدّادٌ تصاعديّ (طلب المستخدم 2026-10-23): الرقمُ يصعد من 0 إلى قيمته حين تُفتح الشاشة، ومن قيمته السابقة إلى الجديدة
 * حين تتغيّر (وصولُ البيانات بعد الجلب، أو تغييرُ فلتر) — بدل الظهور دفعةً واحدة. ويظهر مباشرةً لمن طلب تقليل الحركة.
 * `null` يُعرض «—»، والمنازلُ العشرية بقدر الهدف (`utils/countUp.ts`).
 */
const props = withDefaults(defineProps<{
  value: number | null | undefined
  suffix?: string
  /** مدّةُ العدّ بالمللي ثانية. */
  duration?: number
}>(), { suffix: '', duration: 900 })

// القيمةُ الحقيقية في التصيير الأوّل (الخادم والترطيب متطابقان)، ثم يبدأ العدُّ من 0 عند التركيب
const shown = ref<number | null>(props.value ?? null)
let frame = 0

function run(from: number, to: number) {
  cancelAnimationFrame(frame)
  if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shown.value = to
    return
  }
  const decimals = decimalsOf(to)
  const start = performance.now()
  shown.value = from
  const tick = (now: number) => {
    const progress = (now - start) / props.duration
    shown.value = countUpValue(from, to, progress, decimals)
    if (progress < 1) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}

onMounted(() => {
  if (props.value != null) run(0, props.value)
})
watch(() => props.value, (to) => {
  if (to == null) {
    cancelAnimationFrame(frame)
    shown.value = null
    return
  }
  run(shown.value ?? 0, to)
})
onBeforeUnmount(() => cancelAnimationFrame(frame))

const text = computed(() => shown.value == null ? '—' : `${shown.value}${props.suffix}`)
</script>

<template>
  <span class="count-up">{{ text }}</span>
</template>

<style scoped>
/* أرقامٌ بعرضٍ ثابت كي لا يرتجف ما حولها أثناء العدّ */
.count-up { font-variant-numeric: tabular-nums; }
</style>
