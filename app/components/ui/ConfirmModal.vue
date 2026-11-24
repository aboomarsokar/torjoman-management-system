<script setup lang="ts">
/** نافذة تأكيد موحّدة (v-model:open). الرسالة عبر prop أو slot افتراضي. */
withDefaults(defineProps<{
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  confirmColor?: 'error' | 'primary'
  confirmIcon?: string
  loading?: boolean
}>(), {
  confirmLabel: 'حذف',
  confirmColor: 'error',
  confirmIcon: 'i-lucide-trash-2'
})
const emit = defineEmits<{ 'update:open': [boolean], 'confirm': [] }>()
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <p class="confirm-text">
        <slot>{{ message }}</slot>
      </p>
      <div class="modal-actions">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          size="lg"
          :ui="{ base: 'rounded-[13px]' }"
          @click="emit('update:open', false)"
        />
        <UButton
          :label="confirmLabel"
          :color="confirmColor"
          size="lg"
          :icon="confirmIcon"
          :loading="loading"
          :ui="{ base: 'rounded-[13px] font-semibold min-h-11' }"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.confirm-text { font-size: 15.5px; color: var(--ink-2); line-height: 1.8; margin: 0 0 18px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
