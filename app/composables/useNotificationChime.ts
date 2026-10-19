/**
 * رنّةُ الجرس — نغمتان تُولَّدان في المتصفّح بلا ملفّ صوت (لا تحميلَ من الشبكة)،
 * مكرّرتان مرّتين. سياقُ صوتٍ واحدٌ يُعاد استعماله. والمتصفّحُ يمنع الصوتَ قبل أوّل
 * لمسة، فتُستدرَك الرنّةُ الممنوعة عند أوّل تفاعلٍ إن مضى عليها أقلّ من 20 ثانية.
 * منقولٌ من الصحابة.
 */
const PATTERN = [
  { hz: 880, startsAt: 0, seconds: 0.26 },
  { hz: 660, startsAt: 0.17, seconds: 0.42 }
] as const
const RINGS = 2
const RING_GAP = 0.62
const PEAK_GAIN = 0.3
const SILENT_GAIN = 0.0001
const ATTACK_SECONDS = 0.02
const REPLAY_WINDOW_MS = 20_000
const WAKE_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

export const CHIME_TONES = Array.from({ length: RINGS }, (_, round) =>
  PATTERN.map(tone => ({ ...tone, startsAt: tone.startsAt + round * RING_GAP }))
).flat()

/** يرنّ عند ازدياد غير المقروء، ومرّةً عند أوّل قراءةٍ إن وُجد شيء؛ ولا يرنّ عند النقصان. */
export function shouldRing(before: number | null, next: number): boolean {
  return before === null ? next > 0 : next > before
}

/**
 * قرارُ الرنين لكلّ تغيّرٍ في العدّ: قبل أوّل قراءةٍ ناجحة (`loaded=false`) لا يرنّ ولا يُحتسب
 * الصفرُ الابتدائيّ «أوّلَ قراءة» (الأساس يعود `null`)؛ وبعدها يُحدَّث الأساس ويُسأل `shouldRing`.
 */
export function ringDecision(known: number | null, next: number, loaded: boolean): { known: number | null, ring: boolean } {
  if (!loaded) return { known: null, ring: false }
  return { known: next, ring: shouldRing(known, next) }
}

type AudioContextCtor = typeof AudioContext

function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as { AudioContext?: AudioContextCtor, webkitAudioContext?: AudioContextCtor }
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

export function useNotificationChime() {
  let context: AudioContext | null = null
  let blockedAt = 0

  function ensure(): AudioContext | null {
    const Ctor = contextCtor()
    if (!Ctor) return null
    context ??= new Ctor()
    return context
  }

  function emit(live: AudioContext): void {
    const now = live.currentTime
    for (const tone of CHIME_TONES) {
      const oscillator = live.createOscillator()
      const gain = live.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.value = tone.hz
      const startsAt = now + tone.startsAt
      const endsAt = startsAt + tone.seconds
      gain.gain.setValueAtTime(SILENT_GAIN, startsAt)
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, startsAt + ATTACK_SECONDS)
      gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, endsAt)
      oscillator.connect(gain)
      gain.connect(live.destination)
      oscillator.start(startsAt)
      oscillator.stop(endsAt + ATTACK_SECONDS)
    }
  }

  function removeWakeListeners(): void {
    for (const type of WAKE_EVENTS) window.removeEventListener(type, wake)
  }

  function wake(): void {
    removeWakeListeners()
    const live = ensure()
    if (!live) return
    void live.resume().then(() => {
      const missed = blockedAt > 0 && Date.now() - blockedAt < REPLAY_WINDOW_MS
      blockedAt = 0
      if (missed && live.state === 'running') emit(live)
    }).catch(() => {
      // منعُ التشغيل التلقائيّ ليس خطأً يُعرض: يبقى صامتاً والاهتزازُ يقع في كلّ حال
    })
  }

  if (typeof window !== 'undefined') {
    for (const type of WAKE_EVENTS) window.addEventListener(type, wake, { passive: true })
  }

  // عند تفكيك المكوّن: لا مستمعون معلّقون ولا سياقُ صوتٍ يتراكم مع كلّ دخولٍ وخروج
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (typeof window !== 'undefined') removeWakeListeners()
      void context?.close().catch(() => {
        // إغلاقُ سياقٍ مغلقٍ سلفاً لا يستحقّ إظهاراً
      })
      context = null
    })
  }

  function play(): void {
    try {
      const live = ensure()
      if (!live) return
      if (live.state === 'running') {
        emit(live)
        return
      }
      blockedAt = Date.now()
      void live.resume().then(() => {
        if (live.state === 'running') {
          blockedAt = 0
          emit(live)
        }
      }).catch(() => {
        // منعُ التشغيل التلقائيّ ليس خطأً يُعرض — يُستدرَك عند أوّل تفاعل (wake)
      })
    } catch {
      // متصفّحٌ بلا صوتٍ يبقى صامتاً، والاهتزازُ يقع في كلّ حال
    }
  }

  return { play }
}
