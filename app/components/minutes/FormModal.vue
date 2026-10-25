<script setup lang="ts">
/**
 * نافذةُ إنشاء المحضر وتعديله: قسمُ «الاجتماع» (العنوان والتاريخ والحاضرون) وقسمُ «المحضر»
 * (جدول الأعمال والقرارات والأمور المؤجّلة والمهام — حقولٌ تتمدّد مع النصّ، بندٌ في كلّ سطر).
 * الحالةُ تُختار بالزرّ: «حفظ مسودّة» أو «اعتماد المحضر»، والحفظُ نفسُه في الصفحة (`save`).
 */
import { PROJECT_START_DATE } from '~/constants/project'
import { roleLabel } from '~/constants/roles'
import type { MinuteForm, MinuteRow, MinuteStaff, MinuteStatus } from '~/utils/minutes'
import { MINUTE_FIELD_MAX_ROWS, MINUTE_FIELD_MIN_ROWS, MINUTE_SECTIONS, emptyMinuteForm, minuteFormFrom } from '~/utils/minutes'

const props = defineProps<{
  /** المحضرُ المعدَّل، أو null لمحضرٍ جديد. */
  editing: MinuteRow | null
  staff: MinuteStaff[]
  /** الحالةُ التي يُحفظ بها الآن (لدوّارة زرّها)، أو null. */
  saving: MinuteStatus | null
  today: string
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [form: MinuteForm, status: MinuteStatus] }>()

const form = reactive<MinuteForm>(emptyMinuteForm(props.today))
const titleTouched = ref(false)

watch([open, () => props.editing], ([isOpen, row]) => {
  if (!isOpen) return
  Object.assign(form, row ? minuteFormFrom(row) : emptyMinuteForm(props.today))
  titleTouched.value = false
}, { immediate: true })

const titleError = computed(() => titleTouched.value && !form.title.trim() ? 'اكتب عنوان المحضر.' : undefined)
const isFinal = computed(() => props.editing?.status === 'final')
const busy = computed(() => props.saving !== null)

const selected = computed(() => new Set(form.attendees))
function toggleAttendee(id: string) {
  form.attendees = selected.value.has(id) ? form.attendees.filter(a => a !== id) : [...form.attendees, id]
}
const allSelected = computed(() => props.staff.length > 0 && props.staff.every(s => selected.value.has(s.id)))

function submit(status: MinuteStatus) {
  titleTouched.value = true
  if (!form.title.trim()) return
  emit('save', { ...form, attendees: [...form.attendees] }, status)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'تعديل المحضر' : 'محضر جديد'"
    :description="editing ? undefined : 'وثّق الاجتماع الإداري: من حضر، وما طُرح، وما حُسم، وما أُجِّل.'"
    :ui="{ content: 'max-w-4xl', body: 'sm:p-7' }"
  >
    <template #body>
      <form
        class="mf"
        @submit.prevent="submit(isFinal ? 'final' : 'draft')"
      >
        <section
          class="mf-sec"
          aria-labelledby="mf-meeting"
        >
          <h3
            id="mf-meeting"
            class="mf-h"
          >
            الاجتماع
          </h3>
          <div class="mf-row">
            <UFormField
              label="العنوان / الموضوع"
              required
              :error="titleError"
              class="mf-title"
            >
              <UInput
                v-model="form.title"
                size="xl"
                class="w-full"
                placeholder="مثال: اجتماع الإدارة الشهري"
                :ui="{ base: 'rounded-[13px]' }"
                @blur="titleTouched = true"
              />
            </UFormField>
            <UFormField
              label="التاريخ"
              class="mf-date"
            >
              <UInput
                v-model="form.meeting_date"
                type="date"
                :min="PROJECT_START_DATE"
                size="xl"
                class="w-full"
                :ui="{ base: 'rounded-[13px] tabular-nums' }"
              />
            </UFormField>
          </div>

          <div class="att">
            <div class="att-head">
              <span class="att-label">الحاضرون</span>
              <span class="att-count">{{ form.attendees.length }} من {{ staff.length }}</span>
              <UButton
                :label="allSelected ? 'لا أحد' : 'الكلّ'"
                color="neutral"
                variant="ghost"
                size="sm"
                class="att-all"
                :disabled="!staff.length"
                @click="form.attendees = allSelected ? [] : staff.map(s => s.id)"
              />
            </div>
            <div
              v-if="staff.length"
              class="att-grid"
              role="group"
              aria-label="الحاضرون"
            >
              <button
                v-for="s in staff"
                :key="s.id"
                type="button"
                class="att-chip"
                :class="{ on: selected.has(s.id) }"
                :aria-pressed="selected.has(s.id)"
                @click="toggleAttendee(s.id)"
              >
                <span
                  class="att-box"
                  aria-hidden="true"
                >
                  <UIcon
                    v-if="selected.has(s.id)"
                    name="i-lucide-check"
                    class="size-[13px]"
                  />
                </span>
                <span class="att-name">{{ s.full_name }}</span>
                <span class="att-role">{{ roleLabel(s.role, s.gender) }}</span>
              </button>
            </div>
            <p
              v-else
              class="att-empty"
            >
              لا عاملين مؤهّلين للحضور.
            </p>
          </div>
        </section>

        <section
          class="mf-sec"
          aria-labelledby="mf-body"
        >
          <h3
            id="mf-body"
            class="mf-h"
          >
            المحضر
          </h3>
          <UFormField
            v-for="s in MINUTE_SECTIONS"
            :key="s.key"
            :label="s.label"
            :description="s.hint"
            :ui="{ description: 'text-[13px]' }"
          >
            <UTextarea
              v-model="form[s.key]"
              autoresize
              :rows="MINUTE_FIELD_MIN_ROWS"
              :maxrows="MINUTE_FIELD_MAX_ROWS"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[13px] leading-[1.95] resize-none' }"
            />
          </UFormField>
        </section>
      </form>
    </template>

    <template #footer>
      <div class="mf-foot">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          size="lg"
          :disabled="busy"
          @click="open = false"
        />
        <div class="mf-acts">
          <UButton
            :label="isFinal ? 'إعادته مسودّة' : 'حفظ مسودّة'"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-save"
            :loading="saving === 'draft'"
            :disabled="busy && saving !== 'draft'"
            :ui="{ base: 'rounded-[13px]' }"
            @click="submit('draft')"
          />
          <UButton
            :label="isFinal ? 'حفظ' : 'اعتماد المحضر'"
            color="primary"
            size="lg"
            icon="i-lucide-check-check"
            :loading="saving === 'final'"
            :disabled="busy && saving !== 'final'"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="submit('final')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.mf { display: flex; flex-direction: column; gap: 30px; }
.mf-sec { display: flex; flex-direction: column; gap: 18px; }
.mf-sec + .mf-sec { padding-top: 26px; border-top: 1px solid var(--line); }
.mf-h { margin: 0; font-size: 17px; font-weight: 600; color: var(--ink); }

.mf-row { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 14px; align-items: start; }

.att { display: flex; flex-direction: column; gap: 10px; }
.att-head { display: flex; align-items: center; gap: 10px; }
.att-label { font-size: 14px; font-weight: 500; color: var(--ink); }
.att-count { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.att-all { margin-inline-start: auto; }
.att-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
.att-chip {
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 10px; row-gap: 1px;
  align-items: center; min-height: 52px; padding: 8px 12px; text-align: start;
  border-radius: var(--r-control); border: 1px solid var(--line-2); background: var(--surface);
  color: var(--ink-2); cursor: pointer; transition: border-color .15s, background-color .15s;
}
.att-chip:hover { border-color: var(--blue); }
.att-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.att-chip.on { background: var(--blue-soft); border-color: var(--blue); }
.att-box {
  grid-row: 1 / 3; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 6px;
  border: 1.5px solid var(--line-2); background: var(--surface); color: var(--on-primary);
  transition: background-color .15s, border-color .15s;
}
.att-chip.on .att-box { background: var(--blue-ink); border-color: var(--blue-ink); }
.att-name { font-size: 14px; font-weight: 500; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-chip.on .att-name { font-weight: 600; color: var(--blue-ink); }
.att-role { font-size: 12px; color: var(--ink-3); }
.att-empty { margin: 0; font-size: 13px; color: var(--ink-3); }

.mf-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; }
.mf-acts { display: flex; gap: 10px; }

@media (max-width: 560px) {
  .mf-row { grid-template-columns: 1fr; }
  .att-grid { grid-template-columns: 1fr; }
  .mf-foot { flex-direction: column-reverse; align-items: stretch; }
  .mf-acts { flex-direction: column-reverse; }
  .mf-acts :deep(button), .mf-foot > :deep(button) { justify-content: center; min-height: 44px; }
}
</style>
