<script setup lang="ts">
/**
 * هيكلُ تحميل لوحة المعلّم بشكلها الحاليّ (طلب المستخدم 2026-10-26 — كان هيكلَ المربّعات القديمة): بطاقةُ الحلقة، ثمّ
 * زرٌّ عريضٌ ممتلئ وثلاثةُ أزرار، ثمّ شريطُ «المطلوب منك» — فلا تقفز الصفحةُ حين تصل البيانات.
 */
</script>

<template>
  <div
    class="tsk"
    aria-busy="true"
    aria-label="جارٍ التحميل"
  >
    <div class="card row">
      <USkeleton class="size-12 shrink-0 rounded-xl" />
      <div class="col">
        <USkeleton class="h-5 w-3/5 rounded-md" />
        <USkeleton class="h-4 w-1/4 rounded-md" />
      </div>
    </div>
    <USkeleton class="h-16 w-full rounded-2xl" />
    <USkeleton
      v-for="i in 3"
      :key="i"
      class="h-[58px] w-full rounded-2xl"
    />
    <USkeleton class="h-[66px] w-full rounded-2xl" />
  </div>
</template>

<style scoped>
.tsk { display: flex; flex-direction: column; gap: 10px; max-width: 760px; }
.card { display: flex; flex-direction: column; gap: 14px; margin-bottom: 6px; padding: 18px 20px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); }
.row { flex-direction: row; align-items: center; }
.col { flex: 1; display: flex; flex-direction: column; gap: 8px; }
</style>
