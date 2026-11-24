<script setup lang="ts">
/**
 * تخفيضُ طلب ملازم يتجاوز حاجةَ الحلقة (المدير الإداري — طلب المستخدم 2026-11-24): عددٌ أقلُّ من المطلوب يُقترح
 * على قدر الحاجة (`fitCopies`)، وسببٌ يصل المعلّمَ في الإشعار. وإن لم تبقَ حاجةٌ أصلاً (صفر) فالأنسبُ الإلغاء.
 */
import { MAX_CANCEL_REASON } from '~/constants/booklets'
import { fitCopies, overNeedText, type BookletRoom } from '~/utils/bookletRequests'

const props = defineProps<{ summary: string, copies: number, room: BookletRoom | null, busy: boolean }>()
const emit = defineEmits<{ confirm: [copies: number, reason: string] }>()
const open = defineModel<boolean>('open', { required: true })

const fit = computed(() => (props.room ? fitCopies(props.room, props.copies) : 1))
const need = computed(() => overNeedText(props.room))
const value = ref('')
const reason = ref('')
watch(open, (o) => {
  if (!o) return
  value.value = String(Math.min(Math.max(fit.value, 1), props.copies - 1))
  reason.value = 'على قدر حاجة الحلقة.'
})
const n = computed(() => Number(value.value))
const valid = computed(() => Number.isInteger(n.value) && n.value >= 1 && n.value < props.copies)
</script>

<template>
  <UModal
    v-model:open="open"
    title="تخفيضُ طلب الملازم"
  >
    <template #body>
      <div class="rm">
        <p>طلبُ <b>{{ summary }}</b></p>
        <p
          v-if="need"
          class="rm-need"
        >
          {{ need }}
        </p>
        <p
          v-if="fit === 0"
          class="rm-hint"
        >
          لا تحتاج الحلقةُ نسخاً من هذه الملزمة — الأنسبُ إلغاءُ الطلب، أو خفّضه إن كان لطلابٍ ملتحقين.
        </p>
        <UFormField :label="`العددُ الجديد (أقلُّ من ${copies})`">
          <UInput
            v-model="value"
            type="number"
            inputmode="numeric"
            min="1"
            :max="copies - 1"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField label="السبب (يصل المعلّم — اختياريّ)">
          <UTextarea
            v-model="reason"
            :rows="2"
            autoresize
            :maxlength="MAX_CANCEL_REASON"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="تراجع"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="open = false"
        />
        <UButton
          label="خفّض الطلب"
          icon="i-lucide-arrow-down-wide-narrow"
          color="primary"
          :disabled="!valid"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('confirm', n, reason)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rm { display: flex; flex-direction: column; gap: 12px; }
.rm p { margin: 0; color: var(--ink-2); }
.rm b { color: var(--ink); }
.rm-need { font-size: 13.5px; font-weight: 600; color: var(--err) !important; }
.rm-hint { font-size: 13.5px; }
</style>
