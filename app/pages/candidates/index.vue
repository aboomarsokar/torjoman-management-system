<script setup lang="ts">
/**
 * مقابلاتُ المرشّحين (طلب المستخدم 2026-10-30): الطلباتُ الواردة من صفحة الالتحاق العامّة (/join)، وتصفيتُها بالحالة والجنس
 * والبحث، ودعوةُ مرشّحٍ أو مجموعةٍ لمقابلةٍ بموعدٍ ولجنة وإبلاغُهم SMS، وتقييمُ كلّ عضوٍ من حسابه، والقرار، وإنشاءُ حساب المعلّم للمقبول.
 * عضوُ اللجنة من غير الإدارة يرى من أُسند إليه وحده (RLS).
 */
import type { Candidate } from '~/composables/useCandidates'
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'
import { CANDIDATE_STATUS_LABEL, type CandidateStatus } from '~/constants/candidates'
import { staffCredentials, type AccountCredentials } from '~/composables/useAccountAdmin'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'مقابلات المرشّحين — ترجمان' })

const { isAdmin, isTechnical, isWomenAdmin } = usePermissions()
const { profile } = useProfile()
const me = computed(() => profile.value?.id ?? null)
const canManage = computed(() => isAdmin.value || isTechnical.value || isWomenAdmin.value)
const toast = useToast()
const { handle } = useErrorHandler()

const api = useCandidates()
const { candidates, staff, loading, busy } = api
onMounted(() => {
  void api.load()
  void api.loadStaff()
  void api.loadInviteTemplate() // لا يُشترط الدور هنا: الملفُّ قد لا يكون حُمّل بعدُ، والإعداداتُ يقرؤها كلُّ حساب (والإرسالُ للمدير الإداري)
})
const names = computed(() => Object.fromEntries(staff.value.map(s => [s.id, s.name])))

type Filter = 'all' | CandidateStatus
const filter = ref<Filter>('all')
const query = ref('')
const FILTERS: Filter[] = ['all', 'new', 'invited', 'interviewed', 'accepted', 'reserve', 'rejected', 'hired']
const tabs = computed<SegmentTab<Filter>[]>(() => FILTERS.map(f => ({
  key: f,
  label: f === 'all' ? 'الكل' : CANDIDATE_STATUS_LABEL[f],
  icon: f === 'all' ? 'i-lucide-list' : 'i-lucide-dot',
  count: (f === 'all' ? candidates.value.length : candidates.value.filter(c => c.status === f).length) || undefined
})))
const rows = computed(() => {
  const q = query.value.trim()
  return candidates.value.filter(c => (filter.value === 'all' || c.status === filter.value)
    && (!q || c.full_name.includes(q) || c.phone.includes(q) || c.national_id.includes(q)))
})
const selected = ref<string[]>([])
watch(filter, () => (selected.value = []))

const detail = reactive({ open: false, id: '' })
const current = computed(() => candidates.value.find(c => c.id === detail.id) ?? null)
const openDetail = (c: Candidate) => Object.assign(detail, { open: true, id: c.id })

const scheduleOpen = ref(false)
const scheduleFor = ref<Candidate[]>([])
function openSchedule(list: Candidate[]) {
  scheduleFor.value = list
  scheduleOpen.value = true
}
async function saveSchedule(d: Parameters<typeof api.schedule>[0]) {
  if (await api.schedule(d)) {
    scheduleOpen.value = false
    selected.value = []
  }
}
const evalOpen = ref(false)
async function saveEvaluation(scores: (number | null)[], notes: string) {
  if (current.value && me.value && await api.evaluate(current.value.id, me.value, scores, notes)) evalOpen.value = false
}
// رسالةُ الدعوة SMS — نافذةٌ بالصيغة والمعاينة قبل الإرسال (تُحسب من رصيد الرسائل)
const smsFor = ref<Candidate[]>([])
const smsOpen = computed({ get: () => smsFor.value.length > 0, set: v => !v && (smsFor.value = []) })
const templateOpen = ref(false)
async function saveTemplate(t: string) {
  if (await api.saveInviteTemplate(t)) templateOpen.value = false
}
const pendingSms = computed(() => candidates.value.filter(c => c.status === 'invited' && c.interview_at && !c.invite_sms_at))
async function sendSms(ids: string[], template: string, save: boolean) {
  if (await api.sendInviteSms(ids, template, save)) selected.value = []
  smsFor.value = []
}
const confirmRemove = ref(false)
async function remove() {
  if (current.value && await api.remove(current.value.id)) {
    confirmRemove.value = false
    detail.open = false
  }
}

// المقبولُ ← حسابُ معلّمٍ ببياناته (للمدير الإداريّ)، وتظهر بيانات الدخول مرّةً واحدة
const { createStaff } = useAccountAdmin()
const credentials = ref<AccountCredentials | null>(null)
async function hire() {
  const c = current.value
  if (!c) return
  busy.value = true
  try {
    const created = await createStaff({ full_name: c.full_name, role: 'teacher', gender: c.gender, phone: c.phone })
    credentials.value = staffCredentials(c.full_name, created.employee_number, created.temp_password, 'created')
    await api.decide(c.id, 'hired', c.decision_note ?? '')
  } catch (err) {
    handle(err, 'تعذّر إنشاء حساب المعلّم.')
  } finally {
    busy.value = false
  }
}

async function copyJoinLink() {
  const link = `${location.origin}/join`
  try {
    await navigator.clipboard.writeText(link)
    toast.add({ title: 'نُسخ رابط التسجيل.', description: link, color: 'success', icon: 'i-lucide-link' })
  } catch {
    toast.add({ title: 'رابط التسجيل', description: link, color: 'info' })
  }
}
</script>

<template>
  <main class="cp">
    <UiPageHeader
      title="مقابلات المرشّحين"
      :subtitle="canManage ? 'طلبات الالتحاق بمعلّمي ترجمان: الفرز والمقابلة والتقييم والقرار' : 'المرشّحون المسندون إليك في لجنة التحكيم'"
    />
    <div
      v-if="canManage"
      class="cp-bar"
    >
      <UButton
        label="انسخ رابط التسجيل"
        icon="i-lucide-link"
        color="neutral"
        variant="outline"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
        @click="copyJoinLink"
      />
      <UButton
        label="استمارة التحكيم للطباعة"
        icon="i-lucide-printer"
        color="neutral"
        variant="outline"
        to="/candidates/sheet"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
      />
      <UButton
        v-if="isAdmin"
        label="صيغة رسالة الدعوة"
        icon="i-lucide-file-pen-line"
        color="neutral"
        variant="outline"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
        @click="templateOpen = true"
      />
      <UButton
        v-if="isAdmin && pendingSms.length"
        :label="`أرسل الدعوات المعلّقة SMS (${pendingSms.length})`"
        icon="i-lucide-message-square-text"
        color="primary"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="smsFor = pendingSms"
      />
    </div>

    <div class="cp-tools">
      <UiSegmentTabs
        v-model="filter"
        :tabs="tabs"
        label="حالة الطلب"
        class="cp-tabs"
      />
      <UiSearchField
        v-model="query"
        placeholder="ابحث بالاسم أو الجوال أو الهوية"
        class="cp-search"
      />
    </div>

    <div
      v-if="selected.length"
      class="cp-bulk"
      role="region"
      aria-label="إجراءات المحدّدين"
    >
      <span>{{ selected.length }} محدّد</span>
      <UButton
        label="ادعُهم للمقابلة"
        icon="i-lucide-calendar-plus"
        color="primary"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="openSchedule(candidates.filter(c => selected.includes(c.id)))"
      />
      <UButton
        v-if="isAdmin"
        label="أرسل الدعوة SMS"
        icon="i-lucide-message-square-text"
        color="neutral"
        variant="solid"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="smsFor = candidates.filter(c => selected.includes(c.id))"
      />
    </div>

    <UiSkeletonCard
      v-if="loading && !candidates.length"
      :lines="5"
    />
    <UiEmptyState
      v-else-if="!rows.length"
      icon="i-lucide-user-search"
      :title="candidates.length ? 'لا مرشّحين في هذا التصنيف' : 'لا طلبات بعد'"
      :description="canManage && !candidates.length ? 'انسخ رابط التسجيل وانشره، وستظهر الطلبات هنا.' : undefined"
    />
    <CandidatesList
      v-else
      v-model:selected="selected"
      :rows="rows"
      :selectable="canManage"
      :me="me"
      @open="openDetail"
    />

    <CandidatesDetail
      v-model:open="detail.open"
      :candidate="current"
      :names="names"
      :me="me"
      :can-manage="canManage"
      :is-admin="isAdmin"
      :busy="busy"
      @schedule="current && openSchedule([current])"
      @sms="current && (smsFor = [current])"
      @evaluate="evalOpen = true"
      @decide="(s: CandidateStatus, n: string) => current && api.decide(current.id, s, n)"
      @hire="hire"
      @remove="confirmRemove = true"
    />
    <CandidatesScheduleModal
      v-model:open="scheduleOpen"
      :candidates="scheduleFor"
      :staff="staff"
      :busy="busy"
      @save="saveSchedule"
    />
    <CandidatesEvaluateModal
      v-model:open="evalOpen"
      :candidate="current"
      :evaluator-id="me"
      :busy="busy"
      @save="saveEvaluation"
    />
    <CandidatesSmsModal
      v-model:open="smsOpen"
      :candidates="smsFor"
      :template="api.inviteTemplate.value"
      :can-save="isAdmin"
      :busy="busy"
      @send="sendSms"
    />
    <CandidatesSmsModal
      v-model:open="templateOpen"
      :candidates="[]"
      :template="api.inviteTemplate.value"
      :can-save="isAdmin"
      :busy="busy"
      template-only
      @save-template="saveTemplate"
    />
    <UiConfirmModal
      v-model:open="confirmRemove"
      title="حذف المرشّح"
      :message="`سيُحذف «${current?.full_name ?? ''}» وتقييماته نهائياً.`"
      :loading="busy"
      @confirm="remove"
    />
    <AccountCredentialsModal
      :credentials="credentials"
      @close="credentials = null"
    />
  </main>
</template>

<style scoped>
.cp { display: flex; flex-direction: column; gap: 16px; }
.cp-bar { display: flex; flex-wrap: wrap; gap: 8px; }
.cp-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.cp-tabs { flex: 0 1 auto; max-width: 100%; margin-bottom: 0; overflow-x: auto; scrollbar-width: none; }
.cp-tabs::-webkit-scrollbar { display: none; }
.cp-search { flex: 1 1 260px; min-width: 0; }
.cp-bulk {
  position: sticky; top: 84px; z-index: 5; display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px;
  padding: 10px 14px; border-radius: 14px; background: var(--navy); color: var(--on-primary); font-weight: 600; box-shadow: var(--shadow-lg);
}
.cp-bulk > span { margin-inline-end: auto; }
</style>
