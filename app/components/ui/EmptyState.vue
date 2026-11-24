<script setup lang="ts">
/** حالة فارغة/تحميل موحّدة داخل بطاقة: أيقونة + عنوان + وصف + إجراء (slot). */
defineProps<{ icon?: string, title: string, description?: string }>()
</script>

<template>
  <div class="card empty">
    <UIcon
      v-if="icon"
      :name="icon"
      class="size-8"
    />
    <h3>{{ title }}</h3>
    <p v-if="description">
      {{ description }}
    </p>
    <slot />
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); }
.empty { padding: 56px 24px; text-align: center; color: var(--ink-2); display: flex; flex-direction: column; align-items: center; gap: 10px; }
.empty h3 { margin: 6px 0 0; font-size: 19px; font-weight: 700; color: var(--ink); }
.empty p { margin: 0; font-size: 15px; font-weight: 300; }
</style>
