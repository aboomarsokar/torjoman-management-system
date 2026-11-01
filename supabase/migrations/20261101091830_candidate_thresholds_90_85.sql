-- عتباتُ النتيجة الآلية الجديدة (طلب المستخدم 2026-11-01): مقبول ≥ 90 · تأهيل 85–89.9 · مرفوض دون 85 — وتُعاد نتيجةُ
-- كلّ مرشّحٍ مُقيَّمٍ قرارُه غيرُ يدويّ بالعتبات الجديدة. تطابق `CANDIDATE_PASS_MARK` و`CANDIDATE_QUALIFY_MARK` في الواجهة.

create or replace function private.candidate_auto_status(p_avg numeric)
returns public.candidate_status
language sql immutable
set search_path = ''
as $$
  select case when p_avg is null then null
              when p_avg >= 90 then 'accepted'::public.candidate_status
              when p_avg >= 85 then 'reserve'::public.candidate_status
              else 'rejected'::public.candidate_status end
$$;
revoke all on function private.candidate_auto_status(numeric) from public, anon, authenticated;

select private.candidate_recompute(id) from public.candidates
 where exists (select 1 from public.candidate_evaluations e where e.candidate_id = candidates.id);
