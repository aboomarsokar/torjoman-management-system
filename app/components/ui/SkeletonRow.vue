<script setup lang="ts">
/**
 * صفّ هيكلي أفقي (Skeleton) — نائب عن صفوف القوائم الأفقية (تنبيه/محضر)
 * ريثما يكتمل الجلب غير الحاجز. شارة + عنوان + سطر وصف اختياري + سطر ميتا،
 * وزرّ إجراء اختياري على الطرف المقابل.
 */
withDefaults(defineProps<{ desc?: boolean, action?: boolean }>(), {
  desc: true,
  action: true
})
</script>

<template>
  <div
    class="srow"
    aria-hidden="true"
  >
    <div class="srow-main">
      <div class="srow-head">
        <USkeleton class="sbadge" />
        <USkeleton class="stitle" />
      </div>
      <USkeleton
        v-if="desc"
        class="sdesc"
      />
      <div class="smeta">
        <USkeleton class="schip" />
        <USkeleton class="schip" />
      </div>
    </div>
    <USkeleton
      v-if="action"
      class="sbtn"
    />
  </div>
</template>

<style scoped>
.srow { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.srow-main { flex: 1; min-width: 0; }
.srow-head { display: flex; align-items: center; gap: 10px; }
.sbadge { width: 76px; height: 22px; border-radius: 999px; flex: none; }
.stitle { height: 16px; width: 45%; border-radius: 6px; }
.sdesc { height: 13px; width: 70%; border-radius: 6px; margin-top: 9px; }
.smeta { display: flex; gap: 16px; margin-top: 11px; }
.schip { height: 12px; width: 90px; border-radius: 6px; }
.sbtn { width: 130px; height: 34px; border-radius: 11px; flex: none; }

@media (max-width: 560px) { .srow { flex-direction: column; align-items: stretch; } .sbtn { width: 100%; } }
</style>
