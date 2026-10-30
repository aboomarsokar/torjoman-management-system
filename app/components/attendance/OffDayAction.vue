<script setup lang="ts">
/**
 * زرُّ «لم تنعقد الحلقة» في شاشة حضور المعلّم (2026-10-30): ثانويٌّ بجانب «حفظ الحضور» ليومٍ لم يُسجَّل، ورابطٌ «لم تنعقد
 * الحلقة في هذا اليوم؟» ليومٍ سُجّل حضورُه. يومٌ لا يُبلَّغ عنه يُعطَّل فيه ولا يُخفى، وسببُه ظاهرٌ تحته.
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
      v-if="link"
      label="لم تنعقد الحلقة في هذا اليوم؟"
      color="neutral"
      variant="link"
      :disabled="disabled"
      :ui="{ base: 'min-h-11 px-1 font-semibold' }"
      @click="emit('open')"
    />
    <UButton
      v-else
      label="لم تنعقد الحلقة"
      icon="i-lucide-calendar-x"
      color="neutral"
      variant="outline"
      size="lg"
      :disabled="disabled"
      :ui="{ base: 'w-full min-h-12 rounded-xl font-semibold justify-center px-5' }"
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
</style>
