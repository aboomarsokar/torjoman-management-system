<script setup lang="ts">
/**
 * زرُّ «لم تنعقد الحلقة» في شاشة حضور المعلّم (2026-10-30): ثانويٌّ بعد «حفظ الحضور» ليومٍ لم يُسجَّل — وعلى الجوال رابطٌ
 * نصّيٌّ صغيرٌ تحت الحفظ كي لا يطول الشريطُ اللاصق — ورابطٌ «لم تنعقد الحلقة في هذا اليوم؟» ليومٍ سُجّل حضورُه. يومٌ لا
 * يُبلَّغ عنه يُعطَّل فيه ولا يُخفى، وسببُه ظاهرٌ تحته.
 */
defineProps<{
  /** رابطٌ ثانويّ (يومٌ سُجّل حضورُه) بدل الزرّ. */
  link?: boolean
  disabled: boolean
  /** سببُ المنع ظاهراً، أو `null`. */
  block: string | null
}>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <div
    class="oa"
    :class="{ link }"
  >
    <UButton
      v-if="!link"
      label="لم تنعقد الحلقة"
      icon="i-lucide-calendar-x"
      color="neutral"
      variant="outline"
      size="lg"
      class="oa-full"
      :disabled="disabled"
      :ui="{ base: 'w-full min-h-12 rounded-xl font-semibold justify-center px-5' }"
      @click="emit('open')"
    />
    <UButton
      :label="link ? 'لم تنعقد الحلقة في هذا اليوم؟' : 'لم تنعقد الحلقة؟'"
      color="neutral"
      variant="link"
      :class="{ 'oa-short': !link }"
      :disabled="disabled"
      :ui="{ base: 'min-h-11 px-1 font-semibold' }"
      @click="emit('open')"
    />
    <small
      v-if="block"
      class="oa-block"
    >{{ block }}</small>
  </div>
</template>

<style scoped>
.oa { display: flex; flex-direction: column; gap: 4px; }
.oa.link { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
.oa-block { font-size: 12.5px; font-weight: 600; color: var(--ink-3); line-height: 1.5; }
/* الجوال: الحفظُ وحده زرٌّ بعرض الشريط، والبلاغُ رابطٌ صغيرٌ تحته (≥ 44px) وسببُ منعه بجانبه */
/* الزرُّ والرابطُ متكاملان على الحدّ نفسه: الواسعُ زرٌّ، والجوالُ (≤ 520) رابط — لا فجوةَ ولا تداخلَ عند 520.5 */
.oa-short { display: none; }
@media (max-width: 520px) {
  .oa-full { display: none; }
  .oa-short { display: inline-flex; }
  .oa:not(.link) { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0 10px; }
}
</style>
