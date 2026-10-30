<script setup lang="ts">
/**
 * شريطُ يوم الإجازة العامة في شاشة حضور المعلّم (بلاغ «لم تنعقد» 2026-10-30): «إجازة — السبب» بدل القائمة، بلا
 * «حفظ الحضور» ولا «لم تنعقد الحلقة». هادئٌ عن قصد: الإجازةُ ليست يوماً ناقصاً.
 */
defineProps<{
  /** سببُ الإجازة كما عيّنه المدير الإداري. */
  reason: string
}>()
</script>

<template>
  <div
    class="hb"
    role="status"
  >
    <UIcon
      name="i-lucide-calendar-heart"
      class="size-6 shrink-0"
    />
    <div class="hb-text">
      <b>إجازة — {{ reason }}</b>
      <span>لا يُسجَّل في هذا اليوم حضور.</span>
    </div>
  </div>
</template>

<style scoped>
.hb { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-2); }
.hb-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hb-text b { font-size: 15.5px; font-weight: 700; color: var(--ink); line-height: 1.6; }
.hb-text span { font-size: 13.5px; color: var(--ink-3); }
</style>
