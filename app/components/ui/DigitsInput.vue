<script setup lang="ts">
/**
 * حقلٌ لا يقبل إلا الأرقام: تُحوَّل الأرقامُ العربية إلى لاتينية، ويُحذف ما سواها فوراً من الحقل نفسه، ويُقصّ إلى `max` خانة.
 * و`maxValue` (اختياريّ) يرفض الإدخالَ الذي يتجاوز قيمته فيبقى الرقمُ السابق.
 * بقيّةُ الخصائص (size, placeholder, autocomplete…) تُمرَّر إلى UInput.
 */
import { digitsOnly } from '~/constants/identity'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ max: number, maxValue?: number }>()
const model = defineModel<string>({ required: true })
const input = useTemplateRef<{ inputRef: HTMLInputElement | null }>('input')

// آخرُ قيمةٍ مقبولة — النموذجُ يتأخّر عن الكتابة السريعة فلا يُرجَع إليه
let accepted = model.value
watch(model, v => (accepted = v))

function sync(v: unknown) {
  let clean = digitsOnly(String(v ?? '')).slice(0, props.max)
  if (props.maxValue !== undefined && clean !== '' && Number(clean) > props.maxValue) clean = accepted
  accepted = clean
  model.value = clean
  // القيمةُ قد لا تتغيّر (حرفٌ مرفوض) فلا يُعاد الرسم — نصحّح الحقلَ مباشرة
  const el = input.value?.inputRef
  if (el && el.value !== clean) el.value = clean
}
</script>

<template>
  <UInput
    ref="input"
    v-bind="$attrs"
    :model-value="model"
    inputmode="numeric"
    dir="ltr"
    @update:model-value="sync"
  />
</template>
