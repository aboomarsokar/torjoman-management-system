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
    <div class="q-grid">
      <USkeleton class="h-16 w-full rounded-2xl q-first" />
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-[58px] w-full rounded-2xl"
      />
    </div>
    <USkeleton class="h-[66px] w-full rounded-2xl" />
  </div>
</template>

<style scoped>
/* بعرض اللوحة وشبكة أزرارها على الشاشة الكبيرة (TeacherHome — 2026-10-27) */
.tsk { display: flex; flex-direction: column; gap: 10px; }
.q-grid { display: flex; flex-direction: column; gap: 10px; }
@media (min-width: 900px) {
  .q-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .q-first { height: 58px; }
}
@media (min-width: 1280px) {
  .q-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.card { display: flex; flex-direction: column; gap: 14px; margin-bottom: 6px; padding: 18px 20px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); }
.row { flex-direction: row; align-items: center; }
.col { flex: 1; display: flex; flex-direction: column; gap: 8px; }
</style>
