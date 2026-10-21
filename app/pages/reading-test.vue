<script setup lang="ts">
/**
 * اختبارُ مقرّر القراءة (للطالب وحده) — شاشةُ تمهيد (عددُ الأسئلة والمدّة وعلامةُ النجاح) ثم «ابدأ الاختبار»:
 * عشرون سؤالاً من بنك المقرّر بخياراتٍ مخلوطة، وساعةٌ تعدّ تنازلياً وتسلّم تلقائياً عند الصفر، ثم النتيجة.
 * المنطقُ في `useReadingTest`، والتصحيحُ في القاعدة (لا تصل الإجاباتُ الصحيحة إلى الجهاز).
 * من ليس طالباً يُعاد إلى لوحته.
 */
import type { Database } from '~/types/database.types'
import { formatClock } from '~/composables/useReadingTest'
import { unitScope } from '~/utils/reading'
import { formatDay } from '~/utils/reportWindow'
import { isolateLtr } from '~/utils/transport'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'اختبار القراءة — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
watch(role, (r) => {
  if (r && r !== 'student') void navigateTo('/dashboard', { replace: true })
}, { immediate: true })

// صفُّ الطالب ← مسارُه: المقرّرُ المطلوب وكتبُه في التمهيد، وتاريخُ الإعادة إن كان ينتظر
const { data: me } = useLazyAsyncData('reading-test-student', async () => {
  const id = profile.value?.id
  if (!id) return null
  const { data } = await supabase.from('students').select('id, enrollment_date').eq('user_id', id).maybeSingle()
  return data
}, { server: false, default: () => null, watch: [() => profile.value?.id] })
const { journey, settings } = useReadingPlan(() => ({ studentId: me.value?.id ?? '', enrollmentDate: me.value?.enrollment_date ?? null }))
const { phase, payload, answers, result, errorMessage, remaining, unanswered, start, choose, submit } = useReadingTest()

const confirmOpen = ref(false)
function requestSubmit() {
  if (unanswered.value > 0) confirmOpen.value = true
  else void submit()
}

const lowTime = computed(() => remaining.value > 0 && remaining.value <= 60)
const LETTERS = ['أ', 'ب', 'ج', 'د']
</script>

<template>
  <div class="rt">
    <NuxtLink
      to="/me"
      class="back"
    >
      <UIcon
        name="i-lucide-chevron-right"
        class="size-[18px]"
      />
      <span>عودة إلى صفحتي</span>
    </NuxtLink>

    <ClientOnly>
      <!-- التمهيد -->
      <section
        v-if="phase === 'intro' || phase === 'loading'"
        class="card intro"
      >
        <span class="big-ico"><UIcon
          name="i-lucide-clipboard-pen"
          class="size-7"
        /></span>
        <h2>اختبار مقرّر القراءة</h2>
        <!-- المقرّرُ المطلوب: اسمُه وكتبُه وصفحاتُه -->
        <div
          v-if="journey.due"
          class="unit"
        >
          <div class="unit-label">
            المقرّر المطلوب
          </div>
          <div class="unit-title">
            {{ journey.due.title }}
          </div>
          <div class="unit-scope">
            {{ unitScope(journey.due) }}
          </div>
        </div>
        <p
          v-else-if="journey.total && !journey.due"
          class="done"
        >
          أتممتَ مقرّرات القراءة كلّها 🎉
        </p>
        <ul class="facts">
          <li><strong>{{ settings.reading_test_questions }}</strong> سؤالاً من بنك المقرّر، لكلّ سؤالٍ أربعة خيارات</li>
          <li><strong>{{ settings.reading_test_minutes }}</strong> دقيقة، ويُسلَّم الاختبار تلقائياً عند انتهائها</li>
          <li>النجاح من <strong>{{ settings.reading_pass_mark }}٪</strong> — وإن لم تنجح تعيد بعد {{ settings.reading_retry_days }} أيام</li>
        </ul>
        <p
          v-if="journey.retryOn && !journey.open"
          class="wait"
        >
          تستطيع إعادة الاختبار ابتداءً من {{ isolateLtr(formatDay(journey.retryOn)) }}
        </p>
        <UButton
          :label="journey.open ? 'أكمل الاختبار' : 'ابدأ الاختبار'"
          icon="i-lucide-play"
          color="primary"
          size="xl"
          :loading="phase === 'loading'"
          :disabled="!journey.canStart"
          :ui="{ base: 'min-h-12 rounded-xl font-semibold justify-center' }"
          @click="start"
        />
      </section>

      <!-- خطأ (بنكٌ ناقص، انتظارٌ بعد الرسوب، أتمّ المقرّرات…) -->
      <UiEmptyState
        v-else-if="phase === 'error'"
        icon="i-lucide-circle-alert"
        :title="errorMessage"
      />

      <!-- الاختبار -->
      <template v-else-if="(phase === 'test' || phase === 'submitting') && payload">
        <div
          class="bar"
          :class="{ low: lowTime }"
        >
          <div class="bar-title">
            {{ payload.unit_title }}
          </div>
          <div class="bar-progress">
            أجبتَ {{ payload.total - unanswered }} من {{ payload.total }}
          </div>
          <div
            class="clock"
            role="timer"
            :aria-label="`الوقت الباقي ${formatClock(remaining)}`"
          >
            <UIcon
              name="i-lucide-timer"
              class="size-5"
            />
            <span dir="ltr">{{ formatClock(remaining) }}</span>
          </div>
        </div>

        <ol class="qs">
          <li
            v-for="(q, i) in payload.questions"
            :key="q.id"
            class="card q"
          >
            <div class="q-head">
              <span class="q-n">{{ i + 1 }}</span>
              <p class="q-body">
                {{ q.body }}
              </p>
            </div>
            <div
              class="opts"
              role="radiogroup"
              :aria-label="`خيارات السؤال ${i + 1}`"
            >
              <button
                v-for="(o, j) in q.options"
                :key="o.k"
                type="button"
                role="radio"
                class="opt"
                :class="{ on: answers[q.id] === o.k }"
                :aria-checked="answers[q.id] === o.k"
                :disabled="phase === 'submitting'"
                @click="choose(q.id, o.k)"
              >
                <span class="opt-l">{{ LETTERS[j] }}</span>
                <span class="opt-t">{{ o.text }}</span>
              </button>
            </div>
          </li>
        </ol>

        <div class="submit">
          <UButton
            label="سلّم الاختبار"
            icon="i-lucide-send"
            color="primary"
            size="xl"
            block
            :loading="phase === 'submitting'"
            :ui="{ base: 'min-h-12 rounded-xl font-semibold justify-center' }"
            @click="requestSubmit"
          />
        </div>
      </template>

      <!-- النتيجة -->
      <section
        v-else-if="phase === 'result' && result"
        class="card intro"
        :class="result.passed ? 'pass' : 'fail'"
      >
        <span class="big-ico"><UIcon
          :name="result.passed ? 'i-lucide-party-popper' : 'i-lucide-rotate-ccw'"
          class="size-7"
        /></span>
        <h2>{{ result.passed ? 'نجحت — بارك الله فيك' : 'لم تبلغ علامة النجاح هذه المرّة' }}</h2>
        <div class="score">
          {{ result.score }}<span>/ {{ result.total }}</span>
        </div>
        <p class="pct">
          {{ result.percent }}٪ — النجاح من {{ settings.reading_pass_mark }}٪
        </p>
        <p class="next">
          {{ result.passed ? 'انتقلتَ إلى المقرّر التالي.' : `راجع المقرّر، وتستطيع الإعادة بعد ${settings.reading_retry_days} أيام.` }}
        </p>
        <UButton
          to="/me"
          label="العودة إلى صفحتي"
          color="neutral"
          variant="outline"
          size="lg"
          :ui="{ base: 'min-h-11 rounded-xl justify-center' }"
        />
      </section>
    </ClientOnly>

    <UiConfirmModal
      :open="confirmOpen"
      title="تسليم الاختبار"
      :message="`بقي ${unanswered} سؤالاً بلا إجابة، ويُحسب غيرُ المُجاب خطأً. هل تسلّم الآن؟`"
      confirm-label="سلّم"
      confirm-color="primary"
      @update:open="confirmOpen = $event"
      @confirm="confirmOpen = false; submit()"
    />
  </div>
</template>

<style scoped>
.rt { max-width: 760px; margin: 0 auto; }
.back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; font-size: 14.5px; font-weight: 600; color: var(--ink-2); }
.back:hover { color: var(--ink); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.intro { padding: 28px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; }
.big-ico { width: 60px; height: 60px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; background: var(--blue-soft); color: var(--blue-ink); }
.pass .big-ico { background: var(--green-soft); color: var(--green-ink); }
.fail .big-ico { background: var(--err-soft); color: var(--err); }
.intro h2 { margin: 0; font-size: 21px; font-weight: 700; color: var(--ink); }
.unit { width: 100%; padding: 14px 16px; border-radius: 16px; background: var(--blue-soft); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; }
.unit-label { font-size: 13px; font-weight: 600; color: var(--blue-ink); }
.unit-title { font-size: 18px; font-weight: 800; color: var(--ink); }
.unit-scope { font-size: 15px; color: var(--ink-2); line-height: 1.7; }
.done { margin: 0; font-size: 15px; font-weight: 700; color: var(--green-ink); }
.wait { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--err); }
.facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 15px; color: var(--ink-2); line-height: 1.7; }
.facts strong { color: var(--ink); }
.score { font-size: 54px; font-weight: 800; color: var(--ink); line-height: 1; font-variant-numeric: tabular-nums; }
.score span { font-size: 22px; color: var(--ink-3); margin-inline-start: 6px; }
.pct { margin: 0; font-size: 15px; color: var(--ink-2); }
.next { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: var(--ink); }

.bar { position: sticky; top: 8px; z-index: 5; display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 16px; border-radius: 16px; background: var(--band); color: #fff; box-shadow: var(--shadow-lg); }
.bar-title { font-weight: 700; font-size: 15.5px; }
.bar-progress { font-size: 13.5px; color: var(--band-sub); }
.clock { margin-inline-start: auto; display: inline-flex; align-items: center; gap: 7px; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.bar.low { background: var(--err); }
.bar.low .bar-progress { color: #fff; }

.qs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.q { padding: 18px; }
.q-head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
.q-n { flex: none; width: 30px; height: 30px; border-radius: 9px; background: var(--surface-3); color: var(--ink); font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
.q-body { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); line-height: 1.8; }
.opts { display: grid; gap: 8px; }
.opt { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 10px 14px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font: inherit; font-size: 15px; text-align: start; cursor: pointer; transition: background .15s, border-color .15s; }
.opt:hover { border-color: var(--blue); }
.opt.on { background: var(--blue-soft); border-color: var(--blue); box-shadow: 0 0 0 2px var(--ring); }
.opt:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.opt-l { flex: none; width: 28px; height: 28px; border-radius: 999px; border: 1px solid var(--line-2); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13.5px; color: var(--ink-2); background: var(--surface); }
.opt.on .opt-l { background: var(--blue); border-color: var(--blue); color: #fff; }
.opt-t { line-height: 1.7; }
.submit { margin: 18px 0 8px; }
</style>
