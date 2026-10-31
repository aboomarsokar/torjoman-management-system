<script setup lang="ts">
/**
 * تأكيدُ «تمّ التسليم» لطلب ملازم بتاريخه (اليومُ افتراضاً) — يُسجَّل التسليمُ في الأرشيف ويُغلَق الطلب ويُشعَر المعلّم
 * (طلب المستخدم 2026-10-25؛ استُخرج من `Requests.vue` في 2026-10-31).
 */
import { gazaToday } from '~/utils/reportWindow'
import { PROJECT_START_DATE } from '~/constants/project'

const props = defineProps<{ teacher: string, halaqa: string, summary: string, busy: boolean }>()
const emit = defineEmits<{ confirm: [deliveredOn: string] }>()
const open = defineModel<boolean>('open', { required: true })

const today = gazaToday()
const deliveredOn = ref(today)
watch(open, (o) => {
  if (o) deliveredOn.value = today
})
const valid = computed(() => !!deliveredOn.value && deliveredOn.value <= today && !!props.summary)
</script>

<template>
  <UModal
    v-model:open="open"
    title="تأكيدُ التسليم"
  >
    <template #body>
      <div class="dl">
        <p>
          هل سلّمتَ <b>{{ teacher }}</b> ({{ halaqa }}) <b>{{ summary }}</b>؟
        </p>
        <UFormField label="تاريخ التسليم">
          <UInput
            v-model="deliveredOn"
            type="date"
            :min="PROJECT_START_DATE"
            :max="today"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <p class="dl-hint">
          يُسجَّل التسليمُ في الأرشيف ويُخصم من المخزون، ويُغلَق الطلب، ويصل المعلّمَ إشعارٌ بالتسليم وتاريخه.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="open = false"
        />
        <UButton
          label="نعم، تمّ التسليم"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          :disabled="!valid"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('confirm', deliveredOn)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.dl { display: flex; flex-direction: column; gap: 14px; }
.dl p { margin: 0; color: var(--ink); line-height: 1.8; }
.dl .dl-hint { color: var(--ink-3); font-size: 13.5px; }
</style>
