/**
 * منعُ الكتابة في جلسة النيابة — الطبقةُ التي تغطّي ما لا تغطّيه RLS: service_role يتخطّاها كلَّها،
 * فحارسُ القاعدة وحدَه يترك مساراتِ الخادم تكتب باسم الهدف.
 * يُستدعى في مسارات الكتابة وحدها (حجبُ القراءة يكسر النيابة نفسَها) — ويحرس ذلك impersonationGuardCoverage.test.ts.
 */
import type { Caller } from './caller'
import { IMPERSONATION_READ_ONLY_MESSAGE } from '~/constants/impersonation'

export function requireWritableSession(caller: Pick<Caller, 'canWrite'>): void {
  if (!caller.canWrite) {
    // النصُّ يقول إنّه منعٌ مقصودٌ لا عطب — ويطابق ما ترميه القاعدة.
    throw createError({ statusCode: 403, statusMessage: IMPERSONATION_READ_ONLY_MESSAGE })
  }
}
