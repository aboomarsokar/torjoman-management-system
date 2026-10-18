<script setup lang="ts">
/**
 * تنبيه كلمة المرور الافتراضية (must_change_password) — يُعرض لصاحب الحساب في ملفه
 * (العامل) وفي «صفحتي» (الطالب). الزرّ يُعلم الصفحة لتفتح نافذة التغيير.
 */
const emit = defineEmits<{ change: [] }>()
</script>

<template>
  <div class="pw-banner">
    <UIcon
      name="i-lucide-shield-alert"
      class="size-5"
    />
    <span>كلمة مرورك ما زالت الافتراضية — يُرجى تغييرها لحماية حسابك.</span>
    <UButton
      label="تغيير الآن"
      color="warning"
      size="sm"
      icon="i-lucide-key-round"
      :ui="{ base: 'rounded-[11px] font-semibold' }"
      @click="emit('change')"
    />
  </div>
</template>

<style scoped>
.pw-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--warn-soft, #fef3c7); color: var(--warn-ink, #92400e); border: 1px solid var(--warn, #f59e0b); border-radius: 14px; padding: 12px 16px; font-size: 14.5px; font-weight: 600; margin-bottom: 18px; }
.pw-banner span { flex: 1; min-width: 180px; }
</style>
