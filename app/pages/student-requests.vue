<script setup lang="ts">
/**
 * «طلبات الطلاب» (طلب المستخدم 2026-10-27، وكانت «طلبات إضافة الطلاب»): المعلّمُ يطلب إضافةَ طالبٍ لحلقته — ومنذ
 * 2026-10-28 حذفَه من ملفّه (`StudentRequestsRemovalCard`) — ويتابع طلباتِه؛ والمديرُ الإداريّ يُنشئ الحسابَ من طلب الإضافة
 * (تُعرض الكلمةُ المؤقّتة مرّةً) أو يُنهي التحاقَ الطالب بطلب الحذف (بتأكيد)، أو يرفض بسبب؛ والمديرةُ الإدارية ترى طلباتِ
 * البنات ومشرفُ المشروع الكلَّ اطّلاعاً. الحكمُ لـRLS ومسارِ الخادم ودالّةِ القاعدة.
 */
import type { AccountCredentials } from '~/composables/useAccountAdmin'
import type { StudentRequest, StudentRequestDraft } from '~/composables/useStudentRequests'
import { REJECT_NOTE_MIN } from '~/constants/studentRequests'
import { studentRequestDraft } from '~/utils/chatDrafts'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'طلبات الطلاب — ترجمان' })

const supabase = useSupabaseClient()
const { profile } = useProfile()
const { role, isAdmin, isTeacher, isWomenAdmin } = usePermissions()
const { openWithDraft } = useChatList()
const canView = computed(() => ['teacher', 'admin_manager', 'women_admin', 'project_supervisor'].includes(role.value ?? ''))

// المعلّم: حلقتُه الواحدة
const { data: halaqa } = useLazyAsyncData('student-requests-halaqa', async () => {
  const me = profile.value?.id
  if (!me || !isTeacher.value) return null
  const { data } = await supabase.from('halaqat').select('id, name, gender').eq('teacher_id', me).limit(1).maybeSingle()
  return data
}, { server: false, default: () => null, watch: [() => profile.value?.id, isTeacher] })
const halaqaId = computed(() => (isTeacher.value ? halaqa.value?.id ?? null : undefined))
const female = computed(() => halaqa.value?.gender === 'female')

const { requests, pending, busy, addRequest, approve, reject, refresh } = useStudentRequests(halaqaId)
const removal = useStudentRemoval()

// إنهاءُ التحاق الطالب بطلب الحذف — بتأكيد (يخرج من القوائم ويُوقَف حسابُه)
const removing = ref<StudentRequest | null>(null)
async function confirmRemove() {
  if (removing.value && await removal.approveRemoval(removing.value.id)) {
    removing.value = null
    await refresh()
  }
}

const asking = ref(false)
async function save(d: StudentRequestDraft) {
  if (!halaqa.value) return
  if (await addRequest(halaqa.value.id, d)) asking.value = false
}

const credentials = ref<AccountCredentials | null>(null)
async function onApprove(r: StudentRequest) {
  credentials.value = await approve(r)
}

const rejecting = ref<StudentRequest | null>(null)
const rejectNote = ref('')
watch(rejecting, (r) => {
  if (r) rejectNote.value = ''
})
async function confirmReject() {
  if (rejecting.value && await reject(rejecting.value.id, rejectNote.value)) rejecting.value = null
}
</script>

<template>
  <div class="sr">
    <UiPageHeader
      title="طلبات الطلاب"
      :subtitle="isTeacher
        ? 'اطلب إضافةَ طالبٍ لحلقتك، أو حذفَه من ملفّه — فتبتّ الإدارةُ في الطلب وتُشعرك.'
        : 'ما يطلبه المعلّمون من إضافة طلابٍ أو حذفهم، والبتُّ فيه.'"
    >
      <template
        v-if="isTeacher && halaqa"
        #actions
      >
        <UButton
          :label="female ? 'طلبُ إضافة طالبة' : 'طلبُ إضافة طالب'"
          icon="i-lucide-user-plus"
          color="primary"
          size="lg"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="asking = true"
        />
      </template>
    </UiPageHeader>
    <ClientOnly>
      <UiEmptyState
        v-if="role && !canView"
        icon="i-lucide-lock"
        title="هذه الصفحة للمعلّمين والإدارة."
      />
      <UiSkeletonRow
        v-else-if="pending && !requests.length"
        :action="false"
      />
      <StudentRequestsList
        v-else
        :rows="requests"
        :can-decide="isAdmin"
        :busy="busy || removal.busy.value"
        :show-teacher="!isTeacher"
        :can-chat="isAdmin || isWomenAdmin"
        @approve="onApprove"
        @remove="(r: StudentRequest) => removing = r"
        @reject="(r: StudentRequest) => rejecting = r"
        @chat="(r: StudentRequest) => openWithDraft(r.requested_by, studentRequestDraft(r.halaqa?.teacher?.full_name, r.full_name, r.halaqa?.gender === 'female', r.kind))"
      />
    </ClientOnly>

    <StudentRequestsRequestModal
      v-model:open="asking"
      :busy="busy"
      :female="female"
      @save="save"
    />
    <AccountCredentialsModal
      :credentials="credentials"
      @close="credentials = null"
    />
    <UiConfirmModal
      :open="!!removing"
      title="إنهاءُ التحاق الطالب"
      confirm-label="نعم، أنهِ التحاقه"
      confirm-color="error"
      confirm-icon="i-lucide-user-minus"
      :loading="removal.busy.value"
      @update:open="(v: boolean) => { if (!v) removing = null }"
      @confirm="confirmRemove"
    >
      سيصير <b>{{ removing?.full_name }}</b> «منقطعاً» من اليوم: يخرج من قوائم حلقته والحضور والرصد، ويُوقَف حسابُه، ويبقى
      سجلُّه كاملاً — ويُعاد من صفحة الطلاب متى شئت.
      <span
        v-if="removing?.note"
        class="why"
      >سببُ المعلّم: {{ removing.note }}</span>
    </UiConfirmModal>
    <UModal
      :open="!!rejecting"
      title="رفضُ الطلب"
      @update:open="(v: boolean) => { if (!v) rejecting = null }"
    >
      <template #body>
        <div class="rj">
          <p>رفضُ طلب {{ rejecting?.kind === 'remove' ? 'حذف' : 'إضافة' }} <b>{{ rejecting?.full_name }}</b> — يصل السببُ للمعلّم.</p>
          <UFormField label="سبب الرفض">
            <UTextarea
              v-model="rejectNote"
              :rows="3"
              autoresize
              class="w-full"
              placeholder="مثلاً: الطالب مسجّل في حلقةٍ أخرى"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="rejecting = null"
          />
          <UButton
            label="ارفض الطلب"
            icon="i-lucide-x"
            color="error"
            :loading="busy"
            :disabled="rejectNote.trim().length < REJECT_NOTE_MIN"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="confirmReject"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.sr { display: flex; flex-direction: column; gap: 16px; }
.rj { display: flex; flex-direction: column; gap: 12px; }
.rj p { margin: 0; line-height: 1.8; color: var(--ink); }
.why { display: block; margin-top: 10px; color: var(--ink-2); }
</style>
