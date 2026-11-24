<script setup lang="ts">
/**
 * شبكة حقول هيكلية (Skeleton) — نائبة عن أقسام بيانات (ملف شخصي/طالب):
 * بطاقة بعنوان + شبكة صناديق «تسمية/قيمة» بعدد `fields`. لاستخدامها ضِمن
 * صفحات تفاصيل بها عدّة أقسام كهذه، كرِّرها بعدد الأقسام.
 */
withDefaults(defineProps<{ fields?: number }>(), {
  fields: 6
})
</script>

<template>
  <div
    class="slcard"
    aria-hidden="true"
  >
    <USkeleton class="sltitle" />
    <div class="slgrid">
      <div
        v-for="i in fields"
        :key="i"
        class="slfield"
      >
        <USkeleton class="sllabel" />
        <USkeleton class="slvalue" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.slcard { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 24px; box-shadow: var(--shadow); }
.sltitle { height: 17px; width: 140px; border-radius: 7px; margin-bottom: 18px; }
.slgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.slfield { background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 13px 15px; }
.sllabel { height: 11px; width: 60%; border-radius: 5px; margin-bottom: 9px; }
.slvalue { height: 15px; width: 80%; border-radius: 6px; }
</style>
