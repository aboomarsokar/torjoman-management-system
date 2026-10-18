<script setup lang="ts">
/**
 * نافذة تغيير كلمة المرور لصاحب الحساب — مشتركة بين الملف الشخصي للعامل وصفحة الطالب «صفحتي».
 * تغيّر كلمة المرور في Supabase Auth ثم تُنزل علَم must_change_password عن صفّ الحساب
 * (الحارس في القاعدة يسمح لصاحب الحساب بإنزاله وحده، لا برفعه).
 */
import type { Database } from '~/types/database.types'
import { PASSWORD_MIN_LENGTH } from '~/constants/auth'

interface Props {
  /** معرّف الحساب (profiles.id) الذي يُنزَل عنه علَم التغيير. */
  profileId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const supabase = useSupabaseClient<Database>()
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
  if (pw.next.length < PASSWORD_MIN_LENGTH) {
    toast.add({ title: `كلمة المرور ${PASSWORD_MIN_LENGTH} أحرف على الأقل.`, color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  if (pw.next !== pw.confirm) {
    toast.add({ title: 'الكلمتان غير متطابقتين.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: pw.next })
    if (error) throw error
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', props.profileId)
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
