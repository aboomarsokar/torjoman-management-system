<script setup lang="ts">
/**
 * رسالةُ النتيجة SMS (طلب المستخدم 2026-10-31): لكلّ قرارٍ صيغتُه المعتمدة (مقبول · احتياط · مرفوض، والمعيَّنُ بصيغة
 * المقبول) قابلةً للتعديل، ومعاينةُ رسالة كلّ مستلمٍ ومقاطعُها، واعتمادُ المعدَّل للمرّات القادمة. بلا مستلمين
 * (`templateOnly`) تصير محرّرَ الصيغ الثلاث بلا إرسال.
 */
import type { Candidate } from '~/composables/useCandidates'
import type { ResultTemplates } from '~/composables/useCandidateResultSms'
import { DEFAULT_RESULT_SMS, MAX_INVITE_SMS_TEMPLATE, RESULT_SMS_KINDS, RESULT_SMS_LABEL, RESULT_SMS_VARS } from '~/constants/candidates'
import { renderResultSms, resultKind } from '~/utils/candidates'
import { SMS_MAX_SEGMENTS, smsSegments } from '~/utils/sms'

const props = defineProps<{ candidates: Candidate[], templates: ResultTemplates, canSave: boolean, busy: boolean, templateOnly?: boolean }>()
const emit = defineEmits<{ send: [ids: string[], templates: ResultTemplates, save: boolean], saveTemplates: [templates: ResultTemplates] }>()
const open = defineModel<boolean>('open', { required: true })

const text = ref<ResultTemplates>({ ...props.templates })
const save = ref(false)
watch(open, (o) => {
  if (!o) return
  text.value = { ...props.templates }
  save.value = false
})
const ready = computed(() => props.candidates.filter(c => resultKind(c.status)))
const already = computed(() => ready.value.filter(c => c.result_sms_at).length)
/** الصيغُ التي تلزم هذا الإرسال — أو الثلاثُ في محرّر الصيغ. */
const kinds = computed(() => props.templateOnly
  ? [...RESULT_SMS_KINDS]
  : RESULT_SMS_KINDS.filter(k => ready.value.some(c => resultKind(c.status) === k)))
const previews = computed(() => props.templateOnly
  ? RESULT_SMS_KINDS.map(k => ({ id: k, who: `مثال — ${RESULT_SMS_LABEL[k]}`, text: renderResultSms(text.value[k], { full_name: 'أحمد محمد', gender: 'male' }) }))
  : ready.value.map(c => ({
      id: c.id,
      who: `${c.full_name} — ${RESULT_SMS_LABEL[resultKind(c.status)!]}${c.result_sms_at ? ' · وصلته من قبل' : ''}`,
      text: renderResultSms(text.value[resultKind(c.status)!], c)
    })))
const totalSegments = computed(() => previews.value.reduce((n, p) => n + smsSegments(p.text).segments, 0))
const changed = computed(() => RESULT_SMS_KINDS.some(k => text.value[k].trim() !== props.templates[k].trim()))
const problem = computed(() => {
  if (!props.templateOnly && !ready.value.length) return 'لا مرشّحَ مقرَّرٌ بين المحدّدين — سجّل القرار أوّلاً.'
  if (kinds.value.some(k => text.value[k].trim().length < 10)) return 'اكتب نصّ كلّ رسالة.'
  if (previews.value.some(p => smsSegments(p.text).segments > SMS_MAX_SEGMENTS)) return `رسالةٌ أطول من ${SMS_MAX_SEGMENTS} مقاطع — اختصرها.`
  return null
})
const trimmed = (): ResultTemplates => ({ accepted: text.value.accepted.trim(), reserve: text.value.reserve.trim(), rejected: text.value.rejected.trim() })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="templateOnly ? 'صيغ رسائل النتيجة SMS' : 'إرسال النتيجة SMS'"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div class="rs">
        <p class="rs-who">
          <template v-if="templateOnly">
            الصيغُ المعتمدةُ لكلّ رسائل النتيجة القادمة — المعاينةُ بمرشّحٍ مثال.
          </template>
          <template v-else>
            ستُرسل إلى <b>{{ ready.length }}</b> مرشّح، كلٌّ بصيغة قراره<template v-if="candidates.length > ready.length">
              · ويُترك {{ candidates.length - ready.length }} بلا قرار
            </template><template v-if="already">
              · منهم {{ already }} وصلتهم النتيجة من قبل
            </template>
          </template>
        </p>
        <UFormField
          v-for="k in kinds"
          :key="k"
          :label="`رسالة ${RESULT_SMS_LABEL[k]}`"
        >
          <UTextarea
            v-model="text[k]"
            :rows="3"
            autoresize
            :maxlength="MAX_INVITE_SMS_TEMPLATE"
            class="w-full"
          />
          <template #hint>
            <UButton
              v-if="text[k].trim() !== DEFAULT_RESULT_SMS[k]"
              label="الأصلي"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="link"
              size="xs"
              @click="text[k] = DEFAULT_RESULT_SMS[k]"
            />
          </template>
        </UFormField>
        <p class="rs-vars">
          المتغيّرات:
          <code
            v-for="v in RESULT_SMS_VARS"
            :key="v"
          >{{ v }}</code>
        </p>
        <section
          v-if="previews.length"
          class="rs-previews"
          aria-label="معاينة الرسائل"
        >
          <h3>المعاينة · الرسائل: {{ previews.length }} · المقاطع إجمالاً: {{ totalSegments }}</h3>
          <ul>
            <li
              v-for="p in previews"
              :key="p.id"
            >
              <small>{{ p.who }}</small>
              <p>{{ p.text }}</p>
            </li>
          </ul>
        </section>
        <UCheckbox
          v-if="canSave && changed && !templateOnly"
          v-model="save"
          label="اعتمِد هذه الصيغ للمرّات القادمة"
        />
        <p
          v-if="problem"
          class="rs-err"
          role="alert"
        >
          {{ problem }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="rs-foot">
        <span>{{ templateOnly ? 'لا تُرسَل أيُّ رسالة' : 'تُحسب من رصيد الرسائل' }}</span>
        <div class="flex gap-2">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="open = false"
          />
          <UButton
            v-if="templateOnly"
            label="اعتمد الصيغ"
            icon="i-lucide-check"
            color="primary"
            :loading="busy"
            :disabled="!!problem || !changed"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="emit('saveTemplates', trimmed())"
          />
          <UButton
            v-else
            :label="`أرسل إلى ${ready.length}`"
            icon="i-lucide-send"
            color="primary"
            :loading="busy"
            :disabled="!!problem"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="emit('send', ready.map(c => c.id), trimmed(), save && changed)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rs { display: flex; flex-direction: column; gap: 14px; }
.rs-who { margin: 0; color: var(--ink-2); line-height: 1.8; }
.rs-who b { color: var(--ink); font-variant-numeric: tabular-nums; }
.rs-vars { margin: 0; font-size: 13px; color: var(--ink-3); }
.rs-vars code { display: inline-block; margin-inline-start: 6px; padding: 0 6px; border-radius: 6px; background: var(--surface-3); color: var(--blue-ink); font-family: inherit; font-size: 12.5px; }
.rs-previews { display: flex; flex-direction: column; gap: 8px; }
.rs-previews h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.rs-previews ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.rs-previews li { padding: 10px 14px; border-radius: 12px; background: var(--surface-3); display: flex; flex-direction: column; gap: 4px; }
.rs-previews small { color: var(--ink-3); font-size: 12px; }
.rs-previews p { margin: 0; color: var(--ink); line-height: 1.9; white-space: pre-line; }
.rs-err { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--err-soft); color: var(--err); font-weight: 600; font-size: 14px; }
.rs-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; flex-wrap: wrap; }
.rs-foot > span { color: var(--ink-3); font-size: 13px; }
</style>
