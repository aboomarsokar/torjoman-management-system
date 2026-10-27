<script setup lang="ts">
/**
 * «رسائل SMS» (طلب المستخدم 2026-10-27): المديرُ الإداريّ يكتب رسالةً ويختار مستلميها من الكادر أو جهاتِ الاتصال
 * الخارجية أو أرقاماً يدوية، فيرى عددَ المقاطع والرصيد ويؤكّد ثم يُرسل عبر MTC. والمديرُ الفنيّ والمديرةُ الإدارية
 * لكادر قسمهما وحده ويريان ما أرسلاه، ومشرفُ المشروع يقرأ السجلّ.
 */
import type { Recipient } from '~/composables/useSms'
import { parseManualNumbers } from '~/composables/useSms'
import { rewriteAudience } from '~/composables/useAiRewrite'
import { SMS_MAX_SEGMENTS, dedupeRecipients, smsSegments } from '~/utils/sms'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'رسائل SMS — ترجمان' })

const { role, isAdmin, isTechnical, isWomenAdmin } = usePermissions()
const canView = computed(() => ['admin_manager', 'technical_manager', 'women_admin', 'project_supervisor'].includes(role.value ?? ''))
/** من يرسل: المديرُ الإداريّ لأيّ رقم، والفنيّ لكادر البنين، والمديرةُ لكادر البنات. */
const canSend = computed(() => isAdmin.value || isTechnical.value || isWomenAdmin.value)
const section = computed(() => (isTechnical.value ? 'male' : isWomenAdmin.value ? 'female' : null))
const { staff, contacts, log, balance, balanceError, sending, progress, refreshBalance, addContact, removeContact, send } = useSms()
onMounted(() => {
  watch(canSend, (a) => {
    if (a) refreshBalance()
  }, { immediate: true })
})

type Tab = 'staff' | 'contacts' | 'log'
const tab = ref<Tab>('staff')
const message = ref('')
const staffPicked = ref<Recipient[]>([])
const contactsPicked = ref<Recipient[]>([])
const manual = ref('')

const sectionStaff = computed(() => (section.value ? staff.value.filter(s => s.gender === section.value) : staff.value))
const all = computed(() => dedupeRecipients([...staffPicked.value, ...contactsPicked.value, ...parseManualNumbers(manual.value).list]).valid)
const seg = computed(() => smsSegments(message.value))
const tooLong = computed(() => seg.value.segments > SMS_MAX_SEGMENTS)
const tabs = computed(() => [
  { key: 'staff' as const, label: 'الكادر', icon: 'i-lucide-users', count: staffPicked.value.length },
  { key: 'contacts' as const, label: 'جهاتٌ خارجية', icon: 'i-lucide-contact', count: contactsPicked.value.length + parseManualNumbers(manual.value).list.length },
  { key: 'log' as const, label: 'السجلّ', icon: 'i-lucide-history' }
])

const audience = computed(() => rewriteAudience(section.value))
const ai = useAiRewrite(() => ({ title: '', body: message.value }), (d) => {
  message.value = d.body
})

const confirming = ref(false)
async function doSend() {
  confirming.value = false
  if (await send(message.value.trim(), all.value)) {
    message.value = ''
    staffPicked.value = []
    contactsPicked.value = []
    manual.value = ''
  }
}
</script>

<template>
  <div class="sms">
    <UiPageHeader
      title="رسائل SMS"
      :subtitle="section ? `رسائلُ نصّيةٌ إلى جوّالات كادر ${section === 'male' ? 'البنين' : 'البنات'}.` : 'رسائلُ نصّيةٌ إلى جوّالات الكادر ومن تحفظه من خارجه — المرشّحين للمقابلات وغيرِهم.'"
    >
      <template
        v-if="canSend"
        #actions
      >
        <div class="bal">
          <UIcon
            name="i-lucide-wallet"
            class="size-4"
          />
          <span v-if="balance !== null">الرصيد: <b>{{ balance }}</b></span>
          <span
            v-else-if="balanceError"
            class="bal-err"
          >{{ balanceError }}</span>
          <span v-else>الرصيد…</span>
        </div>
      </template>
    </UiPageHeader>
    <ClientOnly>
      <UiEmptyState
        v-if="role && !canView"
        icon="i-lucide-lock"
        title="هذه الصفحة للإدارة."
      />
      <template v-else>
        <section
          v-if="canSend"
          class="card compose"
        >
          <UFormField label="نصّ الرسالة">
            <UTextarea
              v-model="message"
              :rows="4"
              autoresize
              class="w-full"
              placeholder="مثلاً: نذكّركم باجتماع المعلمين يوم السبت الساعة 4 عصراً في مقرّ المشروع."
            />
          </UFormField>
          <MessagesRewriteActions
            :busy="ai.busy.value"
            :can-undo="ai.canUndo.value"
            :disabled="!message.trim() || sending"
            @rewrite="ai.rewrite('sms', audience)"
            @undo="ai.undo"
          />
          <div class="meter">
            <span :class="{ bad: tooLong }">{{ seg.length }} حرف · {{ seg.segments }} مقطع ({{ seg.perSegment }} للمقطع)</span>
            <span v-if="progress">جارٍ الإرسال: <b>{{ progress.done }}</b> من {{ progress.total }}</span>
            <span v-else>المستلمون: <b>{{ all.length }}</b></span>
            <UButton
              label="إرسال"
              icon="i-lucide-send"
              color="primary"
              size="lg"
              :disabled="!message.trim() || !all.length || tooLong"
              :loading="sending"
              :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
              @click="confirming = true"
            />
          </div>
        </section>

        <UiSegmentTabs
          v-model="tab"
          :tabs="isAdmin ? tabs : canSend ? tabs.filter(t => t.key !== 'contacts') : tabs.filter(t => t.key === 'log')"
          label="مستلمو الرسالة وسجلّها"
        />
        <section class="card">
          <SmsStaffPicker
            v-if="tab === 'staff' && canSend"
            v-model="staffPicked"
            :staff="sectionStaff"
          />
          <SmsContactsPicker
            v-else-if="tab === 'contacts' && isAdmin"
            v-model="contactsPicked"
            v-model:manual="manual"
            :contacts="contacts"
            :can-edit="isAdmin"
            @add="addContact"
            @remove="removeContact"
          />
          <SmsLog
            v-else
            :rows="log"
          />
        </section>
      </template>
    </ClientOnly>

    <UModal
      :open="confirming"
      title="تأكيدُ الإرسال"
      @update:open="(v: boolean) => { if (!v) confirming = false }"
    >
      <template #body>
        <div class="cf">
          <p>تُرسَل الرسالة إلى <b>{{ all.length }}</b> رقماً، <b>{{ seg.segments }}</b> مقطع لكلٍّ — نحو <b>{{ all.length * seg.segments }}</b> رسالة من الرصيد.</p>
          <p class="cf-body">
            {{ message }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="confirming = false"
          />
          <UButton
            label="نعم، أرسل"
            icon="i-lucide-send"
            color="primary"
            :loading="sending"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="doSend"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.sms { display: flex; flex-direction: column; gap: 16px; }
.card { padding: 16px 18px; border-radius: var(--r-card, 18px); background: var(--surface); border: 1px solid var(--line); }
.compose { display: flex; flex-direction: column; gap: 12px; }
.meter { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: space-between; color: var(--ink-2); font-size: 14px; }
.meter .bad { color: var(--ui-error); font-weight: 600; }
.bal { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 14px; }
.bal-err { color: var(--ui-error); }
.cf { display: flex; flex-direction: column; gap: 12px; }
.cf p { margin: 0; line-height: 1.8; }
.cf-body { padding: 12px 14px; border-radius: 12px; background: var(--surface-2); white-space: pre-wrap; }
</style>
