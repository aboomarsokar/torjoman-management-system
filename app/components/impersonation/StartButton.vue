<script setup lang="ts">
/**
 * زرّ «ادخل بحسابه» بنافذة تأكيد — في قائمة المستخدمين وملفّ الموظف.
 * يظهر بالقائمة البيضاء نفسها التي يحكم بها الخادم (`mayImpersonateRole` من الثوابت المشتركة):
 * فاعلٌ مخوَّل، وهدفٌ نشطٌ يُناب عن دوره، وليس نفسَه، **ولا نيابةَ جارية** (لا نيابة داخل نيابة).
 * الخادمُ هو الحَكَم — هذا إظهارٌ فقط.
 */
import type { Role } from '~/constants/roles'
import { isImpersonatorRole, mayImpersonateRole } from '~/constants/impersonation'
import { impersonateConfirmText } from '~/utils/impersonation'

interface Props {
  profileId: string
  name: string
  role: Role
  status: string
  size?: 'sm' | 'lg'
}
const props = withDefaults(defineProps<Props>(), { size: 'lg' })

const { profile } = useProfile()
const { notImpersonating, start } = useImpersonation()
const { handle } = useErrorHandler()

const visible = computed(() => {
  const me = profile.value
  // قبل اكتمال فحص النيابة مجهول ← لا يظهر (لا يومض داخل نيابة)
  return !!me && notImpersonating.value
    && isImpersonatorRole(me.role) && mayImpersonateRole(me.role, props.role)
    && props.status === 'active' && props.profileId !== me.id
})

const confirmText = computed(() => impersonateConfirmText(props.name))
const open = ref(false)
const starting = ref(false)

async function confirmStart() {
  starting.value = true
  try {
    // النجاحُ تحميلٌ كاملٌ لصفحة الهدف — فلا يُنزل التحميلُ بعده
    await start(props.profileId)
  } catch (err) {
    handle(err, 'تعذّر الدخولُ بحسابه.')
    starting.value = false
  }
}
</script>

<template>
  <template v-if="visible">
    <UButton
      label="ادخل بحسابه"
      color="neutral"
      variant="outline"
      :size="size"
      icon="i-lucide-eye"
      :ui="{ base: size === 'lg' ? 'rounded-[13px] font-semibold' : 'rounded-[10px]' }"
      @click="open = true"
    />
    <UiConfirmModal
      v-model:open="open"
      :title="confirmText.title"
      confirm-label="ادخل"
      confirm-color="primary"
      confirm-icon="i-lucide-eye"
      :loading="starting"
      @confirm="confirmStart"
    >
      <span
        v-for="line in confirmText.lines"
        :key="line"
        class="confirm-line"
      >{{ line }}</span>
    </UiConfirmModal>
  </template>
</template>

<style scoped>
.confirm-line { display: block; }
.confirm-line::before { content: '·'; margin-inline-end: 8px; color: var(--ink-3); }
</style>
