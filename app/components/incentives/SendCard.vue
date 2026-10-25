<script setup lang="ts">
/**
 * «إرسالُ الكشف للمراجعة» في بطاقته وحدَه أسفل كشف الحوافز (طلب المستخدم 2026-10-25): كان ملاصقاً لزرّ «إضافة بند»
 * على الجوال فضغطه كثيرون خطأً، والإرسالُ لا رجعةَ فيه — فيبتعد بفراغٍ واضح ويسأل بمربّع تأكيدٍ بعدد البنود ومجموعها.
 */
defineProps<{ count: number, total: string, busy: boolean }>()
const emit = defineEmits<{ send: [] }>()
const confirmOpen = ref(false)

function confirmSend() {
  confirmOpen.value = false
  emit('send')
}
</script>

<template>
  <section
    class="send"
    aria-labelledby="send-title"
  >
    <div class="send-text">
      <h3 id="send-title">
        إرسالُ الكشف للمراجعة
      </h3>
      <p>حين تنتهي من كلّ البنود. بعد الإرسال لا يُعدَّل الكشف إلا إن أُعيد إليك.</p>
    </div>
    <UButton
      label="إرسال الكشف"
      color="primary"
      size="lg"
      icon="i-lucide-send"
      :loading="busy"
      :ui="{ base: 'rounded-[13px] font-semibold min-h-12 justify-center' }"
      @click="confirmOpen = true"
    />
    <UiConfirmModal
      v-model:open="confirmOpen"
      title="إرسالُ الكشف للمراجعة"
      confirm-label="نعم، أرسل الكشف"
      confirm-color="primary"
      confirm-icon="i-lucide-send"
      :loading="busy"
      @confirm="confirmSend"
    >
      سيُرسَل كشفُ هذا الشهر بـ{{ count }} {{ count === 1 ? 'بند' : 'بنود' }} ومجموعِ {{ total }} ₪، ولن تستطيع تعديله
      بعد الإرسال. هل انتهيت من كلّ البنود؟
    </UiConfirmModal>
  </section>
</template>

<style scoped>
.send { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 28px 0 18px; padding: 20px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.send-text h3 { margin: 0 0 4px; font-size: 15.5px; font-weight: 600; color: var(--ink); }
.send-text p { margin: 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.7; }
@media (max-width: 620px) {
  .send { flex-direction: column; align-items: stretch; margin-top: 36px; padding: 16px; }
}
</style>
