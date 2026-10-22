<script setup lang="ts">
/**
 * نافذةُ «تعديل بيانات التواصل» للطالب نفسه في «صفحتي» — أربعةُ حقولٍ فقط: جوّالُه، وبريدُ وليّ أمره،
 * والسكن، وأقربُ مسجد (طلب المستخدم 2026-10-20). ما سواها (الاسم والهوية والجنس والميلاد والحلقة وجوّالُ
 * وليّ الأمر) تعدّله الإدارة. المنطقُ في useMyContact، والحَكَمُ `update_my_contact()` في القاعدة.
 */
import type { Database } from '~/types/database.types'
import { CONTACT_TEXT_MAX } from '~/constants/studentContact'
import { choiceItems, RESIDENCE_AREAS } from '~/constants/profileChoices'
import { normalizeMyContact, type MyContactInput } from '~/composables/useMyContact'

type StudentRow = Database['public']['Tables']['students']['Row']

interface Props {
  /** صفُّ الطالب الحاليّ — تُملأ منه الحقولُ عند كلّ فتح. */
  student: Pick<StudentRow, 'phone' | 'guardian_email' | 'residence' | 'nearest_mosque'>
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const { saving, saveMyContact } = useMyContact()
const { handle } = useErrorHandler()
const toast = useToast()

const form = reactive<MyContactInput>({ phone: '', guardian_email: '', residence: '', nearest_mosque: '' })
// المنطقةُ قائمةٌ منسدلة (طلب المستخدم 2026-10-22)، والقيمةُ القديمة المكتوبة يدوياً تبقى خياراً
const residenceOptions = computed(() => choiceItems(RESIDENCE_AREAS, form.residence))

// كلُّ فتحٍ يبدأ بالقيم المحفوظة
watch(open, (isOpen) => {
  if (!isOpen) return
  form.phone = props.student.phone ?? ''
  form.guardian_email = props.student.guardian_email ?? ''
  form.residence = props.student.residence ?? ''
  form.nearest_mosque = props.student.nearest_mosque ?? ''
}, { immediate: true })

async function save() {
  const parsed = normalizeMyContact(form)
  if (!parsed.ok) {
    toast.add({ title: parsed.message, color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  try {
    await saveMyContact(parsed.value)
    toast.add({ title: 'حُفظت بياناتك.', color: 'success', icon: 'i-lucide-circle-check' })
    open.value = false
    emit('saved')
  } catch (err) {
    handle(err, 'تعذّر حفظ بياناتك. حاول مجدداً.')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="تعديل بيانات التواصل"
    description="بقيّة بياناتك (الاسم والهوية والحلقة وجوال وليّ الأمر) تعدّلها الإدارة — أخبر معلّمك إن وجدت فيها خطأً."
  >
    <template #body>
      <form
        class="form"
        @submit.prevent="save"
      >
        <UFormField label="جوال الطالب">
          <UInput
            v-model="form.phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            dir="ltr"
            size="lg"
            placeholder="0599123456"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <UFormField label="بريد وليّ الأمر">
          <UInput
            v-model="form.guardian_email"
            type="email"
            inputmode="email"
            autocomplete="email"
            dir="ltr"
            size="lg"
            placeholder="name@example.com"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <UFormField label="المنطقة / المدينة">
          <USelect
            v-model="form.residence"
            :items="residenceOptions"
            placeholder="اختر"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <UFormField label="أقرب مسجد">
          <UInput
            v-model="form.nearest_mosque"
            :maxlength="CONTACT_TEXT_MAX"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <!-- إرسالٌ بـEnter من أيّ حقل -->
        <button
          type="submit"
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
        />
      </form>
    </template>
    <template #footer>
      <div class="modal-foot">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          @click="open = false"
        />
        <UButton
          label="حفظ"
          color="primary"
          icon="i-lucide-check"
          :loading="saving"
          class="min-h-11"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; width: 100%; }
</style>
