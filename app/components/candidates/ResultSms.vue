<script setup lang="ts">
/**
 * رسائلُ النتيجة في صفحة المقابلات (طلب المستخدم 2026-10-31) — للمدير الإداريّ: زرّا «صيغ رسائل النتيجة» و«أرسل
 * النتائج المعلّقة» (المقرَّرون الذين لم تصلهم بعد)، ونافذتا الإرسال والصيغ. والصفحةُ تفتح الإرسالَ لمرشّحٍ أو للمحدّدين
 * بـ`open(list)`، ويُطلق `sent` بعد إرسالٍ ناجح لتُحدَّث القائمة.
 */
import type { Candidate } from '~/composables/useCandidates'
import type { ResultTemplates } from '~/composables/useCandidateResultSms'
import { resultKind } from '~/utils/candidates'

const props = defineProps<{ candidates: Candidate[] }>()
const emit = defineEmits<{ sent: [] }>()

const api = useCandidateResultSms()
const { templates, busy } = api
onMounted(() => void api.loadTemplates())

const pending = computed(() => props.candidates.filter(c => resultKind(c.status) && !c.result_sms_at))
const sendFor = ref<Candidate[]>([])
const sendOpen = computed({ get: () => sendFor.value.length > 0, set: v => !v && (sendFor.value = []) })
const templatesOpen = ref(false)

async function send(ids: string[], t: ResultTemplates, save: boolean) {
  const ok = await api.send(ids, t, save)
  sendFor.value = []
  if (ok) emit('sent')
}
async function saveTemplates(t: ResultTemplates) {
  if (await api.saveTemplates(t)) templatesOpen.value = false
}
defineExpose({ open: (list: Candidate[]) => (sendFor.value = list) })
</script>

<template>
  <UButton
    label="صيغ رسائل النتيجة"
    icon="i-lucide-file-pen-line"
    color="neutral"
    variant="outline"
    :ui="{ base: 'rounded-[12px] min-h-11' }"
    @click="templatesOpen = true"
  />
  <UButton
    v-if="pending.length"
    :label="`أرسل النتائج المعلّقة SMS (${pending.length})`"
    icon="i-lucide-message-square-text"
    color="primary"
    :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
    @click="sendFor = pending"
  />
  <CandidatesResultSmsModal
    v-model:open="sendOpen"
    :candidates="sendFor"
    :templates="templates"
    can-save
    :busy="busy"
    @send="send"
  />
  <CandidatesResultSmsModal
    v-model:open="templatesOpen"
    :candidates="[]"
    :templates="templates"
    can-save
    :busy="busy"
    template-only
    @save-templates="saveTemplates"
  />
</template>
