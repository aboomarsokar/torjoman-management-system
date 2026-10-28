/**
 * إعادةُ صياغة رسائل الإدارة بالذكاء الاصطناعي (طلب المستخدم 2026-10-27): نصُّ SMS أو رسالةٌ للكادر (عنوانٌ وتفاصيل)
 * تُعاد صياغتُها بعربيّةٍ واضحةٍ رصينة مع أيقوناتٍ مناسبة، ضمن حدود الطول. الصياغةُ اقتراحٌ يراه المرسِل قبل أن يعتمده.
 * المفتاحُ خادميٌّ فقط (NUXT_ANTHROPIC_API_KEY) ولا يصل العميل.
 */
import Anthropic from '@anthropic-ai/sdk'
import { MAX_MESSAGE_BODY, MAX_MESSAGE_TITLE } from '~/constants/announcements'
import { SMS_MAX_SEGMENTS } from '~/utils/sms'

export type RewriteKind = 'sms' | 'announcement'
export type RewriteAudience = 'male' | 'female' | 'mixed'
export interface RewriteInput { kind: RewriteKind, audience: RewriteAudience, title: string, body: string }
export interface RewriteOutput { title: string, body: string }

export const REWRITE_MODEL = 'claude-opus-5-5'
/** أقصى ما يُقبل من المرسِل — أطولُ من حدود الرسائل لأنّ المسوّدة قد تكون طويلةً ثمّ تُختصر. */
export const REWRITE_MAX_INPUT = 2000
/** مقطعُ SMS العربيّ (UCS-2) 70 حرفاً، و67 حين تتعدّد المقاطع. */
const SMS_MULTIPART_CHARS = 67

/** حدودُ الطول بحسب النوع: SMS حدُّ مقاطعه، ورسالةُ الكادر حدّا عنوانها وتفاصيلها. */
export function rewriteLimits(kind: RewriteKind): { title: number, body: number } {
  return kind === 'sms'
    ? { title: 0, body: SMS_MAX_SEGMENTS * SMS_MULTIPART_CHARS }
    : { title: MAX_MESSAGE_TITLE, body: MAX_MESSAGE_BODY }
}

/** التعليماتُ الثابتة للنموذج — بلا متغيّراتٍ لكلّ طلب سوى النوع والجمهور. */
export function rewriteSystemPrompt(kind: RewriteKind, audience: RewriteAudience): string {
  const limits = rewriteLimits(kind)
  const audienceLine = audience === 'female'
    ? 'الجمهور معلّماتٌ ومشرفاتٌ (نساءٌ وحدهنّ): خاطبهنّ بصيغة المؤنّث، ولا تستعمل أيقونات القلوب إطلاقاً.'
    : audience === 'male'
      ? 'الجمهور معلّمون ومشرفون (رجالٌ): خاطبهم بصيغة المذكّر.'
      : 'الجمهور مختلطٌ أو غيرُ محدّد: استعمل صيغةً تشمل الجميع (مثل «المعلمين والمعلمات» أو «الإخوة والأخوات»)، ولا تستعمل أيقونات القلوب.'
  const shape = kind === 'sms'
    ? `هذه رسالة SMS قصيرة تصل الجوّال: اجعلها موجزةً مباشرة، بلا تحيّةٍ طويلة ولا دعاءٍ ختاميّ، وليست أطولَ من الأصل إلا قليلاً، بأيقونةٍ أو اثنتين فقط (كلُّ أيقونةٍ تأخذ حرفين، وكلُّ 67 حرفاً مقطعٌ يُخصم من الرصيد)، `
    + `ولا تتجاوز ${limits.body} حرفاً، وكلّما قصرت كان أوفر. اجعل العنوان فارغاً.`
    : `هذه رسالةٌ داخل المنصّة: عنوانٌ قصيرٌ واضح لا يتجاوز ${limits.title} حرفاً يبدأ بأيقونةٍ مناسبة، `
      + `وتفاصيلُ لا تتجاوز ${limits.body} حرفاً منسّقةٌ في أسطرٍ قصيرة، تبدأ النقاطُ بأيقوناتٍ مناسبة (📌 ✅ 📅 ⏰ 📍 🔗 📖 …) دون إسراف. `
      + 'إن لم يكتب المرسِل عنواناً فاستخرجه من التفاصيل.'
  return [
    'أنت محرّرٌ لرسائل إدارة «منصة ترجمان القرآنية»، وهي منصّةٌ لحلقات تحفيظ القرآن في غزّة.',
    'أعد صياغة رسالة المرسِل بعربيّةٍ فصيحةٍ سهلةٍ رصينةٍ تليق بسياقٍ قرآنيّ، واضحةٍ ومهذّبة، ونسّقها بأيقوناتٍ مناسبة.',
    'حافظ على المعنى كاملاً وعلى كلّ معلومةٍ فيها (الأسماء والأيام والتواريخ والأوقات والأرقام والروابط) كما هي حرفياً؛ لا تضف معلومةً ولا وعداً ولا موعداً ليس في الأصل، ولا تحذف شيئاً مهمّاً.',
    'اكتب الأرقام كما كتبها المرسِل، والأشهرَ أرقاماً لا أسماء. لا تستعمل Markdown (لا نجوم ولا عناوين بـ#).',
    'إن احتجت إلى اسم المنصّة فهو «منصة ترجمان القرآنية».',
    audienceLine,
    shape,
    'أعد النتيجة وحدها في الحقلين title و body، بلا شرحٍ ولا مقدّمة.'
  ].join('\n')
}

/** يقرأ ردَّ النموذج (JSON بالمخطّط) ويقصّه على الحدود — احتياطٌ وإن طُلبت الحدود في التعليمات. */
export function parseRewrite(text: string, kind: RewriteKind): RewriteOutput {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'تعذّرت قراءة الصياغة المقترحة — حاول مرّةً أخرى.' })
  }
  const obj = (raw ?? {}) as Record<string, unknown>
  const limits = rewriteLimits(kind)
  const body = String(obj.body ?? '').trim().slice(0, limits.body)
  const title = kind === 'sms' ? '' : String(obj.title ?? '').trim().slice(0, limits.title)
  if (!body && !title) throw createError({ statusCode: 502, statusMessage: 'لم تصل صياغةٌ مقترحة — حاول مرّةً أخرى.' })
  return { title, body }
}

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, body: { type: 'string' } },
  required: ['title', 'body'],
  additionalProperties: false
} as const

/** يطلب الصياغة من Claude. عند رفضٍ أمنيّ يتولّى نموذجٌ احتياطيٌّ الطلبَ نفسَه (fallbacks: default). */
export async function rewriteMessage(input: RewriteInput): Promise<RewriteOutput> {
  const apiKey = useRuntimeConfig().anthropicApiKey
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: 'خدمة الذكاء الاصطناعي غير مُعدّة على الخادم.' })
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 })
  const userText = input.kind === 'sms'
    ? `نصّ الرسالة:\n${input.body}`
    : `العنوان: ${input.title || '(بلا عنوان)'}\n\nالتفاصيل:\n${input.body || '(بلا تفاصيل)'}`
  try {
    const response = await client.beta.messages.create({
      model: REWRITE_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: rewriteSystemPrompt(input.kind, input.audience),
      messages: [{ role: 'user', content: userText }]
    })
    if (response.stop_reason === 'refusal') {
      throw createError({ statusCode: 422, statusMessage: 'تعذّرت إعادة صياغة هذا النصّ — عدّله يدوياً.' })
    }
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
    return parseRewrite(text, input.kind)
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw createError({ statusCode: 429, statusMessage: 'طلباتٌ كثيرة على خدمة الصياغة — انتظر قليلاً ثمّ حاول.' })
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[aiRewrite] مفتاح Anthropic مرفوض')
      throw createError({ statusCode: 503, statusMessage: 'خدمة الذكاء الاصطناعي غير مُعدّة على الخادم.' })
    }
    if (error instanceof Anthropic.APIError) {
      console.error('[aiRewrite] خطأ من Anthropic:', error.status, error.message)
      throw createError({ statusCode: 502, statusMessage: 'تعذّرت إعادة الصياغة الآن — حاول بعد قليل.' })
    }
    throw error
  }
}
