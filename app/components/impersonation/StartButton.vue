<script setup lang="ts">
/**
 * زرّ «ادخل بحسابه» بنافذة تأكيد — في قائمة المستخدمين وملفّ الموظف.
 * يظهر بالقائمة البيضاء وشرطِ القسم اللذين يحكم بهما الخادم (`mayImpersonate` من الثوابت المشتركة):
 * فاعلٌ مخوَّل، وهدفٌ نشطٌ يُناب عن دوره، وليس نفسَه، **ولا نيابةَ جارية** (لا نيابة داخل نيابة).
 * الخادمُ هو الحَكَم — هذا إظهارٌ فقط. والجنسُ إلزاميّ: لو غاب لظهر الزرُّ للمدير الفنيّ عند أنثى (يرفضه الخادم بعدها).
 * والنصُّ بصيغة الفاعل والهدف: «ادخلي بحسابها» للمديرة الإدارية (قرار المستخدم 2026-10-22 — المؤنّث في قسمها).
 */
import type { Role } from '~/constants/roles'
import { isImpersonatorRole, mayImpersonate } from '~/constants/impersonation'
import { impersonateConfirmText } from '~/utils/impersonation'

interface Props {
  profileId: string
  name: string
  role: Role
  status: string
  /** جنسُ الهدف — شرطُ القسم (`mayImpersonate`). */
  gender: string | null
  size?: 'sm' | 'lg'
  /** أيقونةٌ بلا نصّ وتلميحٌ بالنصّ — لصفّ الجدول على الحاسوب (طلب المستخدم 2026-10-25). */
  iconOnly?: boolean
}
const props = withDefaults(defineProps<Props>(), { size: 'lg', iconOnly: false })

const { profile } = useProfile()
const { notImpersonating, start } = useImpersonation()
const { handle } = useErrorHandler()

const visible = computed(() => {
  const me = profile.value
  // قبل اكتمال فحص النيابة مجهول ← لا يظهر (لا يومض داخل نيابة)
  return !!me && notImpersonating.value
    && isImpersonatorRole(me.role) && mayImpersonate(me.role, { role: props.role, gender: props.gender })
    && props.status === 'active' && props.profileId !== me.id
})

const confirmText = computed(() => impersonateConfirmText(props.name, props.gender === 'female'))
const actorFemale = computed(() => profile.value?.role === 'women_admin')
const buttonLabel = computed(() => `${actorFemale.value ? 'ادخلي' : 'ادخل'} ${props.gender === 'female' ? 'بحسابها' : 'بحسابه'}`)
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
    <!-- سهمُ الدخول لا العين: العينُ «تفاصيل» في جدول الحلقات (2026-10-25) -->
    <UTooltip
      v-if="iconOnly"
      :text="buttonLabel"
    >
      <UButton
        color="neutral"
        variant="outline"
        :size="size"
        icon="i-lucide-log-in"
        :aria-label="buttonLabel"
        :ui="{ base: 'rounded-[10px]' }"
        @click="open = true"
      />
    </UTooltip>
    <UButton
      v-else
      :label="buttonLabel"
      color="neutral"
      variant="outline"
      :size="size"
      icon="i-lucide-log-in"
      :ui="{ base: size === 'lg' ? 'rounded-[13px] font-semibold' : 'rounded-[10px]' }"
      @click="open = true"
    />
    <UiConfirmModal
      v-model:open="open"
      :title="confirmText.title"
      :confirm-label="actorFemale ? 'ادخلي' : 'ادخل'"
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
