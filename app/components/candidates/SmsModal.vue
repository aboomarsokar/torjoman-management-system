<script setup lang="ts">
/**
 * إرسالُ دعوة المقابلة SMS (طلب المستخدم 2026-10-30): الصيغةُ المعتمدة قابلةً للتعديل بمتغيّراتها، ومعاينةٌ حيّة لرسالة كلّ
 * مرشّحٍ بموعده وعددُ مقاطعها، والمستلمون (المدعوّون بموعدٍ وحدهم). المدير الإداريّ يعتمد الصيغة المعدّلة للمرّات القادمة.
 * وبلا مستلمين (`templateOnly`) تصير محرّرَ الصيغة وحده: معاينةٌ بمرشّحٍ مثال وزرُّ «اعتمد الصيغة» بلا إرسال.
 */
import type { Candidate } from '~/composables/useCandidates'
import { DEFAULT_INVITE_SMS, INVITE_SMS_VARS, MAX_INVITE_SMS_TEMPLATE } from '~/constants/candidates'
import { renderInviteSms } from '~/utils/candidates'
import { SMS_MAX_SEGMENTS, smsSegments } from '~/utils/sms'

const props = defineProps<{ candidates: Candidate[], template: string, canSave: boolean, busy: boolean, templateOnly?: boolean }>()
const emit = defineEmits<{ send: [ids: string[], template: string, save: boolean], saveTemplate: [template: string] }>()
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
/** مرشّحُ المعاينة في محرّر الصيغة: غداً العاشرة صباحاً. */
const sample = computed(() => {
  const at = new Date()
  at.setDate(at.getDate() + 1)
  at.setHours(10, 0, 0, 0)
  return [{ id: 'sample', full_name: 'أحمد محمد سالم', gender: 'male' as const, invite_sms_at: null, interview_at: at.toISOString(), interview_place: 'مقر المشروع' }]
})
const previews = computed(() => (props.templateOnly ? sample.value : ready.value).map(c => ({
  id: c.id, name: c.full_name, sent: !!c.invite_sms_at,
  text: renderInviteSms(text.value, { ...c, interview_at: c.interview_at! })
})))
/** أطولُ رسالةٍ تحكم: مقاطعُها هي الحدّ، ومجموعُ المقاطع تكلفةُ الإرسال. */
const maxSegments = computed(() => Math.max(0, ...previews.value.map(p => smsSegments(p.text).segments)))
const totalSegments = computed(() => previews.value.reduce((n, p) => n + smsSegments(p.text).segments, 0))
const problem = computed(() => {
  if (!props.templateOnly && !ready.value.length) return 'لا مدعوَّ بموعدٍ بين المحدّدين — ادعُهم للمقابلة أوّلاً.'
  if (text.value.trim().length < 10) return 'اكتب نصّ الرسالة.'
  if (maxSegments.value > SMS_MAX_SEGMENTS) return `الرسالة أطول من ${SMS_MAX_SEGMENTS} مقاطع — اختصرها.`
  return null
})
const changed = computed(() => text.value.trim() !== props.template.trim())
</script>

<template>
  <UModal
    v-model:open="open"
    :title="templateOnly ? 'صيغة رسالة الدعوة SMS' : 'إرسال دعوة المقابلة SMS'"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div class="sm">
        <p
          v-if="templateOnly"
          class="sm-who"
        >
          الصيغةُ المعتمدة لكلّ دعوات المقابلة القادمة — المعاينةُ بمرشّحٍ مثال.
        </p>
        <p
          v-else
          class="sm-who"
        >
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
        <section
          v-if="previews.length"
          class="sm-previews"
          aria-label="معاينة الرسائل"
        >
          <h3>المعاينة · الرسائل: {{ previews.length }} · المقاطع إجمالاً: {{ totalSegments }}</h3>
          <ul>
            <li
              v-for="p in previews"
              :key="p.id"
            >
              <small>{{ templateOnly ? 'مثال' : p.name }}<template v-if="p.sent"> · وصلته من قبل</template></small>
              <p>{{ p.text }}</p>
            </li>
          </ul>
        </section>
        <div class="sm-tools">
          <UCheckbox
            v-if="canSave && changed && !templateOnly"
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
            label="اعتمد الصيغة"
            icon="i-lucide-check"
            color="primary"
            :loading="busy"
            :disabled="!!problem || !changed"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="emit('saveTemplate', text.trim())"
          />
          <UButton
            v-else
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
.sm-previews { display: flex; flex-direction: column; gap: 8px; }
.sm-previews h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.sm-previews ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.sm-previews li { padding: 10px 14px; border-radius: 12px; background: var(--surface-3); display: flex; flex-direction: column; gap: 4px; }
.sm-previews small { color: var(--ink-3); font-size: 12px; }
.sm-previews p { margin: 0; color: var(--ink); line-height: 1.9; white-space: pre-line; }
.sm-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; }
.sm-err { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--err-soft); color: var(--err); font-weight: 600; font-size: 14px; }
.sm-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; flex-wrap: wrap; }
.sm-foot > span { color: var(--ink-3); font-size: 13px; }
</style>
