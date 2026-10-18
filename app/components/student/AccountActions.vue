<script setup lang="ts">
/**
 * حساب دخول الطالب في ملفه — للمدير الإداري وحده: حالة الدخول، وإعادة تعيين كلمة المرور
 * (كلمةٌ مؤقّتة تظهر مرّةً واحدة)، وتعطيل الدخول أو تفعيله (profiles.status).
 * المعطَّل لا يدخل (فحصُ الدخول) ولا يقرأ شيئاً (current_user_role() يشترط النشط)، وتُنهى جلسته عند تحميله التالي.
 * حالة الدخول مستقلّةٌ عن حالة الطالب الدراسية (منقطع/متخرّج…) — قرارُها بيد المدير.
 */
import type { Database } from '~/types/database.types'
import { studentCredentials, type AccountCredentials } from '~/composables/useAccountAdmin'

type ProfileStatus = Database['public']['Enums']['profile_status']

interface Props {
  /** حساب الطالب (students.user_id). */
  userId: string
  studentName: string
  /** رقم الهوية — معرّف الدخول المعروض مع الكلمة المؤقّتة. */
  nationalId: string | null
}

const props = defineProps<Props>()
const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
const { resetPassword } = useAccountAdmin()

const { data: status, refresh } = useLazyAsyncData<ProfileStatus | null>(
  () => `student-account-${props.userId}`,
  async () => {
    const { data } = await supabase.from('profiles').select('status').eq('id', props.userId).maybeSingle()
    return data?.status ?? null
  },
  { server: false, default: () => null }
)
const isActive = computed(() => status.value === 'active')

// ── إعادة تعيين كلمة المرور ──
const confirmReset = ref(false)
const resetting = ref(false)
const credentials = ref<AccountCredentials | null>(null)
async function doReset() {
  resetting.value = true
  try {
    const password = await resetPassword(props.userId)
    credentials.value = studentCredentials(props.studentName, props.nationalId ?? '—', password, 'reset')
    confirmReset.value = false
  } catch (err) {
    handle(err, 'تعذّرت إعادة التعيين.')
  } finally {
    resetting.value = false
  }
}

// ── تعطيل/تفعيل الدخول ──
const toggling = ref(false)
async function toggleLogin() {
  const next: ProfileStatus = isActive.value ? 'disabled' : 'active'
  toggling.value = true
  try {
    const { data, error } = await supabase.from('profiles').update({ status: next }).eq('id', props.userId).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('لم يُحفظ التغيير — قد لا تملك صلاحية تعديل هذا الحساب.')
    toast.add({
      title: next === 'active' ? 'فُعّل دخول الطالب.' : 'عُطّل دخول الطالب.',
      color: next === 'active' ? 'success' : 'neutral',
      icon: next === 'active' ? 'i-lucide-circle-check' : 'i-lucide-ban'
    })
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    toggling.value = false
  }
}
</script>

<template>
  <section class="acct">
    <div class="acct-info">
      <UIcon
        name="i-lucide-key-round"
        class="size-5"
      />
      <span class="acct-title">حساب الدخول</span>
      <UBadge
        v-if="status"
        :label="isActive ? 'الدخول مفعّل' : 'الدخول معطّل'"
        :color="isActive ? 'success' : 'neutral'"
        variant="soft"
      />
    </div>
    <div class="acct-actions">
      <UButton
        label="إعادة تعيين كلمة المرور"
        color="neutral"
        variant="outline"
        icon="i-lucide-key-round"
        :ui="{ base: 'rounded-[11px] min-h-11' }"
        @click="confirmReset = true"
      />
      <UButton
        v-if="status"
        :label="isActive ? 'تعطيل الدخول' : 'تفعيل الدخول'"
        :color="isActive ? 'neutral' : 'success'"
        variant="outline"
        :icon="isActive ? 'i-lucide-ban' : 'i-lucide-power'"
        :loading="toggling"
        :ui="{ base: 'rounded-[11px] min-h-11' }"
        @click="toggleLogin"
      />
    </div>

    <UiConfirmModal
      :open="confirmReset"
      title="إعادة تعيين كلمة المرور"
      :message="`ستُولَّد لـ«${props.studentName}» كلمة مرورٍ مؤقّتة جديدة تظهر لك مرّةً واحدة، وتبطل كلمته الحالية، ويُطلب منه تغييرها عند الدخول.`"
      confirm-label="إعادة التعيين"
      confirm-color="primary"
      confirm-icon="i-lucide-key-round"
      :loading="resetting"
      @confirm="doReset"
      @update:open="(v) => { if (!v) confirmReset = false }"
    />
    <AccountCredentialsModal
      :credentials="credentials"
      @close="credentials = null"
    />
  </section>
</template>

<style scoped>
.acct { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 14px 20px; margin-bottom: 22px; }
.acct-info { display: flex; align-items: center; gap: 10px; color: var(--ink-2); }
.acct-title { font-weight: 600; color: var(--ink); }
.acct-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
