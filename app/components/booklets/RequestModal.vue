<script setup lang="ts">
/**
 * «اطلب ملازم» (المعلّم — طلب المستخدم 2026-10-25): الملزمةُ وعددُ النسخ وملاحظةٌ اختياريّة، والحلقةُ حلقتُه.
 * يُشعَر المديرُ الإداريّ بالطلب، والتحقّقُ في `useBookletRequests`. ومع `initial` يصير تعديلاً لطلبٍ لم يُسلَّم (2026-10-31).
 * وتحت النسخ حاجةُ الحلقة من الملزمة المختارة (`roomOf` — 2026-11-24)، ويُعطَّل الإرسالُ إن تجاوزها؛ وتعديلُ الملاحظة
 * أو التخفيضُ في طلبٍ قائم لا يُعطَّل (يبقى كما كان).
 */
import { BOOKLETS } from '~/constants/booklets'
import type { RequestDraft } from '~/composables/useBookletRequests'
import { roomError, roomLine, type BookletRoom } from '~/utils/bookletRequests'

const props = defineProps<{ busy: boolean, initial?: RequestDraft | null, roomOf?: (booklet: number | undefined) => BookletRoom | null }>()
const emit = defineEmits<{ save: [draft: RequestDraft] }>()
const open = defineModel<boolean>('open', { required: true })

const blank = (): RequestDraft => ({ booklet: undefined, copies: '', note: '' })
const form = reactive<RequestDraft>(blank())
watch(open, (o) => {
  if (o) Object.assign(form, props.initial ? { ...props.initial } : blank())
})
const editing = computed(() => !!props.initial)
/** نسخُ الطلب نفسه إن بقيت ملزمتُه: محسوبةٌ في القائم فلا تُحسب مرّتين. */
const own = computed(() => props.initial && props.initial.booklet === form.booklet ? Number(props.initial.copies) : 0)
const room = computed(() => props.roomOf?.(form.booklet) ?? null)
const grows = computed(() => !props.initial || props.initial.booklet !== form.booklet || Number(form.copies) > Number(props.initial.copies))
const overError = computed(() => (grows.value && form.copies ? roomError(room.value, Number(form.copies), own.value) : null))
const bookletItems = BOOKLETS.map(b => ({ label: `الملزمة ${b.no} — ${b.label}`, value: b.no }))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'تعديلُ طلب الملازم' : 'طلبُ ملازم'"
    :description="editing ? 'يصل التعديلُ إلى المدير الإداري، وإن كان قد أبلغك بالاستلام عاد الطلبُ جديداً.' : 'يصل طلبُك إلى المدير الإداري ليجهّز النسخ.'"
  >
    <template #body>
      <div class="rf">
        <UFormField label="الملزمة">
          <UiSelect
            v-model="form.booklet"
            :items="bookletItems"
            placeholder="اختر الملزمة"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField label="عدد النسخ">
          <UInput
            v-model="form.copies"
            type="number"
            inputmode="numeric"
            min="1"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
          <p
            v-if="room"
            class="room"
          >
            {{ roomLine(room, own) }}
          </p>
          <p
            v-if="overError"
            class="room room-bad"
            role="alert"
          >
            {{ overError }}
          </p>
        </UFormField>
        <UFormField label="ملاحظة (اختياريّة)">
          <UTextarea
            v-model="form.note"
            :rows="2"
            autoresize
            class="w-full"
            placeholder="مثلاً: لطلابٍ التحقوا هذا الشهر"
          />
        </UFormField>
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
          :label="editing ? 'احفظ التعديل' : 'أرسل الطلب'"
          :icon="editing ? 'i-lucide-check' : 'i-lucide-send'"
          color="primary"
          :loading="busy"
          :disabled="!!overError"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('save', { ...form })"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rf { display: flex; flex-direction: column; gap: 14px; }
.room { margin: 6px 2px 0; font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.room-bad { color: var(--err); font-weight: 600; }
</style>
