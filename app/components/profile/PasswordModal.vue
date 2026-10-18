<script setup lang="ts">
/**
 * نافذة تغيير كلمة المرور لصاحب الحساب — مشتركة بين الملف الشخصي للعامل وصفحة الطالب «صفحتي».
 * المنطق في useChangePassword: كلمة Auth ثم إنزال علَم must_change_password مع فحص ناتجه
 * (الحارس في القاعدة يسمح لصاحب الحساب بإنزاله وحده، لا برفعه).
 */
import { PASSWORD_MIN_LENGTH } from '~/constants/auth'
import { passwordChangeError } from '~/composables/useChangePassword'

interface Props {
  /** معرّف الحساب (profiles.id) الذي يُنزَل عنه علَم التغيير. */
  profileId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const { changeOwnPassword } = useChangePassword()
const { handle } = useErrorHandler()
const toast = useToast()

const saving = ref(false)
const pw = reactive({ next: '', confirm: '' })

// كل فتحٍ يبدأ بحقلين فارغين
watch(open, (isOpen) => {
  if (!isOpen) return
  pw.next = ''
  pw.confirm = ''
})

async function changePassword() {
  const invalid = passwordChangeError(pw.next, pw.confirm)
  if (invalid) {
    toast.add({ title: invalid, color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    await changeOwnPassword(props.profileId, pw.next)
    toast.add({ title: 'تم تغيير كلمة المرور.', color: 'success', icon: 'i-lucide-circle-check' })
    open.value = false
    emit('changed')
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="تغيير كلمة المرور"
  >
    <template #body>
      <div class="form">
        <UFormField
          label="كلمة المرور الجديدة"
          :hint="`${PASSWORD_MIN_LENGTH} أحرف على الأقل`"
        >
          <UInput
            v-model="pw.next"
            type="password"
            dir="ltr"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <UFormField label="تأكيد كلمة المرور">
          <UInput
            v-model="pw.confirm"
            type="password"
            dir="ltr"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="modal-foot">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          label="حفظ"
          color="primary"
          icon="i-lucide-check"
          :loading="saving"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="changePassword"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; }
</style>
