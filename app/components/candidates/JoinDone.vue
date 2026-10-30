<script setup lang="ts">
/** شاشةُ «استلمنا طلبك» بعد التسجيل العامّ، وزرُّ متابعة حالة الطلب. */
const emit = defineEmits<{ lookup: [] }>()
</script>

<template>
  <section class="jd">
    <UIcon
      name="i-lucide-circle-check"
      class="size-12"
    />
    <h2>استلمنا طلبك</h2>
    <p>سنراجع بياناتك ونتواصل معك على رقم جوالك لتحديد موعد المقابلة. يمكنك متابعة حالة طلبك برقم هويتك وجوالك.</p>
    <UButton
      label="تابع حالة طلبي"
      icon="i-lucide-search"
      color="primary"
      variant="soft"
      :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
      @click="emit('lookup')"
    />
  </section>
</template>

<style scoped>
.jd { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 24px 8px; color: var(--green-ink); }
.jd h2 { margin: 0; font-size: 22px; color: var(--ink); }
.jd p { margin: 0; color: var(--ink-2); line-height: 1.9; max-width: 440px; }
</style>
