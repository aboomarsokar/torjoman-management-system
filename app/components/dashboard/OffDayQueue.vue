<script setup lang="ts">
/**
 * بطاقةُ «أيامٌ لم تنعقد — بانتظار الاعتماد» في لوحات المعتمِدين (2026-10-30): المشرفُ الميداني والمدير الإداري والمدير الفنيّ
 * والمديرةُ الإدارية. لكلّ بلاغٍ معلّق في نطاق الدور: الحلقةُ واليومُ (dd/mm واسمُ اليوم) والسببُ والملاحظةُ والمعلّمُ بجواله
 * (اتصالٌ وواتس أب — طلب المستخدم 2026-10-30)، ثمّ
 * «قبول» فورياً، و«رفض» يفتح نافذةً صغيرة لسببٍ اختياريّ يراه المعلّم، و«فتح اليوم» إلى «الحضور اليوميّ». لا تُصيَّر شيئاً
 * ما لم يكن في الطابور بند (ولا هيكلَ فارغاً أثناء الجلب)، وتجلب بياناتها بنفسها عند التركيب. المنطقُ في `useOffDayQueue`.
 */
import { OFF_NOTE_MAX, OFF_REASON_LABELS } from '~/utils/offDays'
import { offDayLine, useOffDayQueue, type OffDayQueueItem } from '~/composables/useOffDayQueue'
import { whatsappLink } from '~/utils/halaqatAchievement'

const { items, load, review } = useOffDayQueue()
const toast = useToast()
onMounted(() => void load())

/** البندُ الجاري قبولُه أو رفضُه — يعطّل أزرارَه ويمنع النقرَ المزدوج. */
const busyId = ref<string | null>(null)

async function decide(item: OffDayQueueItem, approve: boolean, note: string | null): Promise<boolean> {
  if (busyId.value) return false
  busyId.value = item.id
  try {
    const ok = await review(item.id, approve, note)
    if (ok) toast.add({ title: approve ? 'اعتُمد البلاغ.' : 'رُفض البلاغ.', color: 'success', icon: 'i-lucide-circle-check' })
    return ok
  } finally {
    busyId.value = null
  }
}

// ── نافذةُ الرفض ──
const rejecting = ref<OffDayQueueItem | null>(null)
const rejectOpen = computed({
  get: () => rejecting.value !== null,
  set: (v) => {
    if (!v) rejecting.value = null
  }
})
const rejectNote = ref('')
function askReject(item: OffDayQueueItem) {
  rejectNote.value = ''
  rejecting.value = item
}
async function confirmReject() {
  const item = rejecting.value
  if (!item) return
  // النجاحُ يُغلق النافذة؛ والفشلُ يُبقيها مفتوحةً بما كُتب (الخطأُ معروضٌ في toast)
  if (await decide(item, false, rejectNote.value)) rejecting.value = null
}

const dayLink = (i: OffDayQueueItem) => `/attendance?h=${i.halaqaId}&d=${i.day}`
// المعلّمُ وجوالُه للتواصل قبل القرار (طلب المستخدم 2026-10-30) — «المعلّمة» لحلقات البنات
const teacherWord = (i: OffDayQueueItem) => (i.halaqaGender === 'female' ? 'المعلّمة' : 'المعلّم')
const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
// من بلّغ يُذكر وحده إن لم يكن معلّمَ الحلقة الحاليّ (تبدّل المعلّم بعد البلاغ)
const otherReporter = (i: OffDayQueueItem) => (i.reporterName && i.reporterName !== i.teacherName ? i.reporterName : null)
</script>

<template>
  <section
    v-if="items.length"
    class="odq"
    aria-labelledby="odq-title"
  >
    <div class="odq-head">
      <h3 id="odq-title">
        <UIcon
          name="i-lucide-calendar-x"
          class="size-5 shrink-0"
        />
        أيامٌ لم تنعقد — بانتظار الاعتماد
        <span class="odq-count">{{ items.length }}</span>
      </h3>
    </div>

    <ul class="odq-list">
      <li
        v-for="i in items"
        :key="i.id"
        class="odq-item"
      >
        <div class="odq-main">
          <span class="odq-halaqa">{{ i.halaqaName }}</span>
          <span class="odq-day"><bdi>{{ offDayLine(i.day) }}</bdi></span>
          <span class="odq-reason">{{ OFF_REASON_LABELS[i.reason] }}<template v-if="i.note"> — {{ i.note }}</template></span>
          <span
            v-if="i.teacherName"
            class="odq-teacher"
          >
            {{ teacherWord(i) }}: <b>{{ i.teacherName }}</b>
          </span>
          <span
            v-if="i.teacherName"
            class="odq-contact"
          >
            <UButton
              v-if="i.teacherPhone"
              :to="telLink(i.teacherPhone)"
              icon="i-lucide-phone"
              color="primary"
              variant="soft"
              :aria-label="`اتصل بـ${teacherWord(i)} ${i.teacherName}`"
              :ui="{ base: 'min-h-11 rounded-[10px] font-semibold', leadingIcon: 'size-4' }"
            >
              <bdi class="odq-num">{{ i.teacherPhone }}</bdi>
            </UButton>
            <span
              v-else
              class="odq-nophone"
            >لا رقم جوال مسجَّل</span>
            <UButton
              v-if="whatsappLink(i.teacherWhatsapp || i.teacherPhone)"
              :to="whatsappLink(i.teacherWhatsapp || i.teacherPhone)!"
              target="_blank"
              rel="noopener"
              icon="i-simple-icons-whatsapp"
              color="success"
              variant="soft"
              size="xs"
              :aria-label="`واتس أب ${teacherWord(i)} ${i.teacherName}`"
              :ui="{ base: 'min-h-11 min-w-11 rounded-[10px] justify-center', leadingIcon: 'size-4' }"
            />
          </span>
          <span
            v-if="otherReporter(i)"
            class="odq-by"
          >بلّغ {{ otherReporter(i) }}</span>
        </div>
        <div class="odq-acts">
          <UButton
            label="قبول"
            icon="i-lucide-check"
            color="primary"
            :loading="busyId === i.id && !rejecting"
            :disabled="!!busyId"
            :ui="{ base: 'min-h-11 min-w-11 rounded-xl font-semibold justify-center' }"
            @click="decide(i, true, null)"
          />
          <UButton
            label="رفض"
            icon="i-lucide-x"
            color="neutral"
            variant="outline"
            :disabled="!!busyId"
            :ui="{ base: 'min-h-11 min-w-11 rounded-xl font-semibold justify-center' }"
            @click="askReject(i)"
          />
          <UButton
            :to="dayLink(i)"
            label="فتح اليوم"
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'min-h-11 min-w-11 rounded-xl font-semibold justify-center' }"
          />
        </div>
      </li>
    </ul>

    <UModal
      v-model:open="rejectOpen"
      title="رفض البلاغ"
      :description="rejecting ? `${rejecting.halaqaName} — ${offDayLine(rejecting.day)}` : undefined"
    >
      <template #body>
        <UFormField label="سبب الرفض (اختياري — يراه المعلّم)">
          <UTextarea
            v-model="rejectNote"
            :rows="3"
            :maxlength="OFF_NOTE_MAX"
            autoresize
            class="w-full"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="تراجع"
            color="neutral"
            variant="ghost"
            :disabled="!!busyId"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="rejectOpen = false"
          />
          <UButton
            label="تأكيد الرفض"
            icon="i-lucide-x"
            color="error"
            :loading="!!busyId"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="confirmReject"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>

<style scoped>
.odq { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; margin-bottom: 18px; }
.odq-head { margin-bottom: 8px; }
.odq-head h3 { margin: 0; display: flex; align-items: center; gap: 9px; font-size: 17px; font-weight: 700; color: var(--ink); }
.odq-count { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.odq-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.odq-item { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 14px 0; border-top: 1px solid var(--line); }
.odq-item:first-child { border-top: none; }
.odq-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 240px; }
.odq-halaqa { font-weight: 700; color: var(--ink); }
.odq-day { font-size: 14px; font-weight: 600; color: var(--chip-warn-ink); font-variant-numeric: tabular-nums; }
.odq-reason { font-size: 14px; color: var(--ink-2); line-height: 1.7; }
.odq-by { font-size: 13px; color: var(--ink-3); }
.odq-teacher { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; font-size: 14px; color: var(--ink-2); }
.odq-teacher b { font-weight: 700; color: var(--ink); }
.odq-contact { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.odq-num { font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.odq-nophone { font-size: 13px; color: var(--ink-3); }
.odq-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
@media (max-width: 520px) {
  .odq { padding: 16px; }
  .odq-acts { width: 100%; }
  .odq-acts :deep(button), .odq-acts :deep(a) { flex: 1 1 auto; }
}
</style>
