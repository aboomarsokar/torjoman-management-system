<script setup lang="ts">
/**
 * شريطُ حالِ اليوم في «الحضور اليوميّ»: الحلقةُ «انعقدت» إذا سُجّل حضورُها — لا زرَّ منفصلاً — ورابطُ «إلغاء حضور هذا اليوم»
 * لمن يكتب.
 */
defineProps<{
  held: boolean
  canWrite: boolean
}>()
const emit = defineEmits<{ cancel: [] }>()
</script>

<template>
  <div
    class="day-state"
    :class="{ on: held }"
  >
    <UIcon
      :name="held ? 'i-lucide-calendar-check' : 'i-lucide-calendar-clock'"
      class="size-5"
    />
    <span>{{ held ? 'سُجّل حضور هذا اليوم — عدّل ثم احفظ إن لزم.' : canWrite ? 'لم يُسجَّل حضور هذا اليوم بعد — الجميع حاضر افتراضاً، سجّل الغيابات ثم احفظ.' : 'لم يُسجَّل حضور هذا اليوم.' }}</span>
    <button
      v-if="held && canWrite"
      type="button"
      class="cancel-link"
      @click="emit('cancel')"
    >
      إلغاء حضور هذا اليوم
    </button>
  </div>
</template>

<style scoped>
.day-state { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--blue-soft); color: var(--blue-ink); font-size: 14.5px; font-weight: 600; line-height: 1.6; }
.day-state.on { background: var(--green-soft); color: var(--green-ink); }
.day-state > span { flex: 1 1 220px; }
.cancel-link { border: none; background: none; padding: 0; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--err); text-decoration: underline; cursor: pointer; min-height: 44px; }
</style>
