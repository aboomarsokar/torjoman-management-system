<script setup lang="ts">
/**
 * «طلبُ حذف الطالب» في ملفّه عند المعلّم (طلب المستخدم 2026-10-28 — بآلية طلبات الإضافة): زرٌّ يفتح نافذةً بسببٍ إلزاميّ
 * فيُرسَل الطلبُ إلى الإدارة؛ وإن كان له طلبٌ مفتوحٌ قالت البطاقةُ ذلك بدل الزرّ. يحتاج اتصالاً — وبلا اتصالٍ يقول الزرُّ
 * ذلك عند ضغطه. والمديرُ الإداريّ يُنهي التحاقَه أو يرفض من «طلبات الطلاب».
 */
import { REMOVE_REASON_MIN } from '~/constants/studentRequests'
import { deliveryDate } from '~/utils/booklets'

const props = defineProps<{ studentId: string, halaqaId: string, name: string, female: boolean }>()

const { online, blockIfOffline } = useOfflineNav()
const { busy, openRemovalFor, requestRemoval } = useStudentRemoval()
const pendingSince = ref<string | null>(null)
const asking = ref(false)
const reason = ref('')

async function loadPending() {
  if (!online.value) return
  pendingSince.value = (await openRemovalFor(props.studentId))?.created_at ?? null
}
onMounted(loadPending)
watch(online, (on) => {
  if (on) void loadPending()
})

function open(event: Event) {
  if (blockIfOffline('/student-requests', event)) return
  reason.value = ''
  asking.value = true
}
async function send() {
  if (await requestRemoval(props.halaqaId, props.studentId, reason.value)) {
    asking.value = false
    await loadPending()
  }
}
const who = computed(() => (props.female ? 'الطالبة' : 'الطالب'))
const leftHint = computed(() => (props.female
  ? 'إن غادرت الحلقة — تُنهي الإدارةُ التحاقَها ويبقى سجلُّها.'
  : 'إن غادر الحلقة — تُنهي الإدارةُ التحاقَه ويبقى سجلُّه.'))
const outcome = computed(() => (props.female
  ? 'فإن وافقت صارت «منقطعة» وخرجت من قوائم الحلقة، ويبقى سجلُّها كاملاً.'
  : 'فإن وافقت صار «منقطعاً» وخرج من قوائم الحلقة، ويبقى سجلُّه كاملاً.'))
</script>

<template>
  <section
    class="card rm"
    :class="{ 'needs-net': !online && !pendingSince }"
  >
    <span class="rm-ico"><UIcon
      name="i-lucide-user-minus"
      class="size-5"
    /></span>
    <div class="rm-txt">
      <b>{{ pendingSince ? `طلبُ حذف ${who} بانتظار الإدارة` : `طلبُ حذف ${who}` }}</b>
      <small v-if="pendingSince">أُرسل <bdi dir="ltr">{{ deliveryDate(pendingSince) }}</bdi> — يصلك إشعارٌ حين تبتّ الإدارةُ فيه.</small>
      <small v-else>{{ online ? leftHint : 'تحتاج اتصالاً بالإنترنت' }}</small>
    </div>
    <UButton
      v-if="!pendingSince"
      label="اطلب الحذف"
      color="error"
      variant="outline"
      :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
      @click="open"
    />

    <UModal
      v-model:open="asking"
      :title="`طلبُ حذف ${who}`"
    >
      <template #body>
        <div class="rm-form">
          <p>يُرسَل طلبُ حذف <b>{{ name }}</b> إلى الإدارة، {{ outcome }}</p>
          <UFormField
            label="السبب"
            required
          >
            <UTextarea
              v-model="reason"
              :rows="3"
              autoresize
              class="w-full"
              placeholder="مثلاً: انتقل إلى مدرسةٍ أخرى، أو انقطع عن الحضور منذ شهر"
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
            @click="asking = false"
          />
          <UButton
            label="أرسل الطلب"
            icon="i-lucide-send"
            color="error"
            :loading="busy"
            :disabled="reason.trim().length < REMOVE_REASON_MIN"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="send"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
.rm { display: flex; align-items: center; gap: 14px; min-height: 68px; padding: 12px 18px; flex-wrap: wrap; }
.rm-ico { width: 42px; height: 42px; flex: none; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--err-soft); color: var(--err); }
.rm-txt { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 2px; }
.rm-txt b { font-size: 15.5px; font-weight: 600; color: var(--ink); }
.rm-txt small { font-size: 13px; font-weight: 500; color: var(--ink-3); line-height: 1.6; }
.rm.needs-net { opacity: .55; }
.rm-form { display: flex; flex-direction: column; gap: 12px; }
.rm-form p { margin: 0; line-height: 1.8; color: var(--ink); }
</style>
