<script setup lang="ts">
/**
 * إرسالُ دعوة المقابلة SMS (طلب المستخدم 2026-10-30): الصيغةُ المعتمدة قابلةً للتعديل بمتغيّراتها، ومعاينةٌ حيّة لأوّل مرشّح
 * وعددُ المقاطع، والمستلمون (المدعوّون بموعدٍ وحدهم). المدير الإداريّ يعتمد الصيغة المعدّلة للمرّات القادمة.
 */
import type { Candidate } from '~/composables/useCandidates'
import { DEFAULT_INVITE_SMS, INVITE_SMS_VARS, MAX_INVITE_SMS_TEMPLATE } from '~/constants/candidates'
import { renderInviteSms } from '~/utils/candidates'
import { SMS_MAX_SEGMENTS, smsSegments } from '~/utils/sms'

const props = defineProps<{ candidates: Candidate[], template: string, canSave: boolean, busy: boolean }>()
const emit = defineEmits<{ send: [ids: string[], template: string, save: boolean] }>()
const open = defineModel<boolean>('open', { required: true })

const text = ref('')
const save = ref(false)
watch(open, (o) => {
  if (!o) return
  text.value = props.template
  save.value = false
})
const ready = computed(() => props.candidates.filter(c => c.status === 'invited' && c.interview_at))
const already = computed(() => ready.value.filter(c => c.invite_sms_at).length)
const preview = computed(() => {
  const c = ready.value[0]
  return c ? renderInviteSms(text.value, { ...c, interview_at: c.interview_at! }) : ''
})
const seg = computed(() => smsSegments(preview.value))
const problem = computed(() => {
  if (!ready.value.length) return 'لا مدعوَّ بموعدٍ بين المحدّدين — ادعُهم للمقابلة أوّلاً.'
  if (text.value.trim().length < 10) return 'اكتب نصّ الرسالة.'
  if (seg.value.segments > SMS_MAX_SEGMENTS) return `الرسالة أطول من ${SMS_MAX_SEGMENTS} مقاطع — اختصرها.`
  return null
})
const changed = computed(() => text.value.trim() !== props.template.trim())
</script>

<template>
  <UModal
    v-model:open="open"
    title="إرسال دعوة المقابلة SMS"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div class="sm">
        <p class="sm-who">
          ستُرسل إلى <b>{{ ready.length }}</b> مرشّح، كلٌّ بموعده ومكانه<template v-if="candidates.length > ready.length">
            · ويُترك {{ candidates.length - ready.length }} غيرُ مدعوّ بموعد
          </template><template v-if="already">
            · منهم {{ already }} وصلتهم الدعوة من قبل
          </template>
        </p>
        <UFormField label="نصّ الرسالة">
          <UTextarea
            v-model="text"
            :rows="4"
            autoresize
            :maxlength="MAX_INVITE_SMS_TEMPLATE"
            class="w-full"
          />
          <template #help>
            المتغيّرات تُستبدل لكلّ مرشّح:
            <code
              v-for="v in INVITE_SMS_VARS"
              :key="v"
              class="sm-var"
            >{{ v }}</code>
          </template>
        </UFormField>
        <div
          v-if="preview"
          class="sm-preview"
        >
          <small>معاينة لـ {{ ready[0]?.full_name }} · {{ seg.segments }} {{ seg.segments === 1 ? 'مقطع' : 'مقاطع' }} لكلّ رسالة</small>
          <p>{{ preview }}</p>
        </div>
        <div class="sm-tools">
          <UCheckbox
            v-if="canSave && changed"
            v-model="save"
            label="اعتمِد هذه الصيغة للمرّات القادمة"
          />
          <UButton
            v-if="text.trim() !== DEFAULT_INVITE_SMS"
            label="استعد النصّ الأصلي"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="ghost"
            size="sm"
            :ui="{ base: 'min-h-11' }"
            @click="text = DEFAULT_INVITE_SMS"
          />
        </div>
        <p
          v-if="problem"
          class="sm-err"
          role="alert"
        >
          {{ problem }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="sm-foot">
        <span>تُحسب من رصيد الرسائل</span>
        <div class="flex gap-2">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="open = false"
          />
          <UButton
            :label="`أرسل إلى ${ready.length}`"
            icon="i-lucide-send"
            color="primary"
            :loading="busy"
            :disabled="!!problem"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="emit('send', ready.map(c => c.id), text.trim(), save && changed)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.sm { display: flex; flex-direction: column; gap: 14px; }
.sm-who { margin: 0; color: var(--ink-2); line-height: 1.8; }
.sm-who b { color: var(--ink); font-variant-numeric: tabular-nums; }
.sm-var { display: inline-block; margin-inline-start: 6px; padding: 0 6px; border-radius: 6px; background: var(--surface-3); color: var(--blue-ink); font-family: inherit; font-size: 12.5px; }
.sm-preview { padding: 12px 14px; border-radius: 12px; background: var(--surface-3); display: flex; flex-direction: column; gap: 4px; }
.sm-preview small { color: var(--ink-3); font-size: 12px; }
.sm-preview p { margin: 0; color: var(--ink); line-height: 1.9; white-space: pre-line; }
.sm-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; }
.sm-err { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--err-soft); color: var(--err); font-weight: 600; font-size: 14px; }
.sm-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; flex-wrap: wrap; }
.sm-foot > span { color: var(--ink-3); font-size: 13px; }
</style>
