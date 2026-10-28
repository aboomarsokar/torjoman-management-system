<script setup lang="ts">
/**
 * «طلبات إضافة الطلاب» (طلب المستخدم 2026-10-27): المعلّمُ يطلب إضافةَ طالبٍ لحلقته ويتابع طلباتِه؛ والمديرُ الإداريّ
 * يُنشئ الحسابَ من الطلب (تُعرض الكلمةُ المؤقّتة مرّةً) أو يرفض بسبب؛ والمديرةُ الإدارية ترى طلباتِ البنات ومشرفُ
 * المشروع الكلَّ اطّلاعاً. الحكمُ لـRLS ومسارِ الخادم.
 */
import type { AccountCredentials } from '~/composables/useAccountAdmin'
import type { StudentRequest, StudentRequestDraft } from '~/composables/useStudentRequests'
import { REJECT_NOTE_MIN } from '~/constants/studentRequests'
import { studentRequestDraft } from '~/utils/chatDrafts'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'طلبات إضافة الطلاب — ترجمان' })

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

const { requests, pending, busy, addRequest, approve, reject } = useStudentRequests(halaqaId)

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
      title="طلبات إضافة الطلاب"
      :subtitle="isTeacher ? 'اطلب إضافةَ طالبٍ لحلقتك، فتُنشئ الإدارةُ حسابَه وتُشعرك.' : 'ما يطلبه المعلّمون من إضافة طلاب، وإضافتُهم أو رفضُها.'"
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
        :busy="busy"
        :show-teacher="!isTeacher"
        :can-chat="isAdmin || isWomenAdmin"
        @approve="onApprove"
        @reject="(r: StudentRequest) => rejecting = r"
        @chat="(r: StudentRequest) => openWithDraft(r.requested_by, studentRequestDraft(r.halaqa?.teacher?.full_name, r.full_name, r.halaqa?.gender === 'female'))"
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
    <UModal
      :open="!!rejecting"
      title="رفضُ الطلب"
      @update:open="(v: boolean) => { if (!v) rejecting = null }"
    >
      <template #body>
        <div class="rj">
          <p>رفضُ طلب إضافة <b>{{ rejecting?.full_name }}</b> — يصل السببُ للمعلّم.</p>
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
</style>
