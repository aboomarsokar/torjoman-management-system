<script setup lang="ts">
/**
 * شريط ترويسة هيكلي (Skeleton) — نائب عن ترويسة صفحات التفاصيل
 * (ملف شخصي/مشرف/حلقة) ريثما يكتمل الجلب غير الحاجز: أيقونة/صورة رمزية +
 * عنوان + سطر فرعي، مع أزرار إجراء اختيارية على الطرف المقابل.
 */
withDefaults(defineProps<{ actions?: number }>(), {
  actions: 0
})
</script>

<template>
  <div
    class="sband"
    aria-hidden="true"
  >
    <div class="sband-id">
      <USkeleton class="sav" />
      <div class="stext">
        <USkeleton class="sname" />
        <USkeleton class="ssub" />
      </div>
    </div>
    <div
      v-if="actions"
      class="sband-actions"
    >
      <USkeleton
        v-for="i in actions"
        :key="i"
        class="sbtn"
      />
    </div>
  </div>
</template>

<style scoped>
.sband { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; }
.sband-id { display: flex; align-items: center; gap: 16px; min-width: 0; }
.sav { width: 64px; height: 64px; border-radius: 18px; flex: none; }
.stext { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sname { height: 20px; width: 180px; border-radius: 7px; }
.ssub { height: 14px; width: 240px; border-radius: 6px; }
.sband-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.sbtn { width: 130px; height: 42px; border-radius: 13px; }
</style>
