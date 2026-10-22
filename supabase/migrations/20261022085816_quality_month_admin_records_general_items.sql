-- سجلُّ تقييم المعلم الشهريّ (قرار المستخدم 2026-10-22): البنودُ العامة (الاجتماعات والملاحظات) والحفظُ والإقفال
-- للمدير الإداري وحده؛ والمشرفُ الميدانيّ يرصد نتيجةَ زيارتيه فقط (نموذج الزيارة) فتدخل السجلَّ آلياً.
-- supervisor_id يبقى مشرفَ الحلقة (لا الحافظ)، والفتحُ يُشعر المديرَ الإداري لا المشرف.
create or replace function public.save_quality_month(p_halaqa uuid, p_year integer, p_month integer, p_meetings integer, p_notes text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_teacher uuid;
  v_sup uuid;
  v_halaqa text;
  v_numbers jsonb;
  v_id uuid;
  v_opens date := private.quality_month_opens(p_year, p_month);
begin
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'admin_manager' then
    raise exception 'رصدُ البنود العامة في سجلّ التقييم للمدير الإداري وحده.' using errcode = '42501';
  end if;
  select h.teacher_id, h.supervisor_id, h.name into v_teacher, v_sup, v_halaqa from public.halaqat h where h.id = p_halaqa;
  if v_halaqa is null then
    raise exception 'الحلقة غير موجودة.' using errcode = '42501';
  end if;
  if p_meetings is null or p_meetings not between 0 and 8 then
    raise exception 'درجةُ حضور الاجتماعات من 0 إلى 8.' using errcode = '23514';
  end if;
  if private.attendance_today() < v_opens then
    raise exception 'يُرصد سجلُّ الشهر ابتداءً من % (بعد مهلة تسليم التقارير).', to_char(v_opens, 'DD-MM-YYYY') using errcode = '23514';
  end if;
  if exists (select 1 from public.teacher_quality_months q
              where q.halaqa_id = p_halaqa and q.year = p_year and q.month = p_month and q.locked_at is not null) then
    raise exception 'السجلّ مقفل — افتحه للتعديل أولاً.' using errcode = '42501';
  end if;

  v_numbers := private.quality_month_compute(p_halaqa, p_year, p_month, p_meetings);
  insert into public.teacher_quality_months as q
    (halaqa_id, teacher_id, supervisor_id, year, month, meetings_score, supervisor_notes,
     numbers, quality, achievement, final, locked_at, teacher_ack_at)
  values (p_halaqa, v_teacher, v_sup, p_year, p_month, p_meetings, nullif(btrim(coalesce(p_notes, '')), ''),
          v_numbers, (v_numbers ->> 'quality')::numeric, (v_numbers ->> 'achievement')::numeric, (v_numbers ->> 'final')::numeric,
          now(), null)
  on conflict (halaqa_id, year, month) do update set
    teacher_id = excluded.teacher_id, supervisor_id = excluded.supervisor_id,
    meetings_score = excluded.meetings_score, supervisor_notes = excluded.supervisor_notes,
    numbers = excluded.numbers, quality = excluded.quality, achievement = excluded.achievement, final = excluded.final,
    locked_at = excluded.locked_at, teacher_ack_at = null
  returning q.id into v_id;

  perform private.notify(v_teacher, 'quality_month', 'سجلُّ تقييمك الشهريّ',
    v_halaqa || ' · ' || lpad(p_month::text, 2, '0') || '-' || p_year
      || coalesce(' · النهائي ' || (v_numbers ->> 'final') || ' من 100', ' · ناقص — لم تُنفَّذ زيارة')
      || ' — اطّلع عليه وأقِرّ',
    '/quality?y=' || p_year || '&m=' || p_month, 'teacher_quality_months', v_id);
  return v_id;
end;
$function$;
revoke all on function public.save_quality_month(uuid, integer, integer, integer, text) from public, anon;
grant execute on function public.save_quality_month(uuid, integer, integer, integer, text) to authenticated;

create or replace function public.unlock_quality_month(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_label text;
begin
  perform private.assert_session_writable();
  if coalesce(public.current_user_role()::text, '') not in ('admin_manager', 'technical_manager') then
    raise exception 'فتحُ السجلّ للمدير الإداري والفنيّ وحدهما.' using errcode = '42501';
  end if;
  update public.teacher_quality_months q set locked_at = null, teacher_ack_at = null
   where q.id = p_id and q.locked_at is not null
  returning (select h.name from public.halaqat h where h.id = q.halaqa_id) || ' · '
            || lpad(q.month::text, 2, '0') || '-' || q.year
    into v_label;
  if v_label is null then
    raise exception 'السجلّ غير مقفل أو غير موجود.';
  end if;
  -- الراصدُ المدير الإداري: يُشعَر إن فتحه الفنيّ (ولا يُشعَر أحدٌ بفعله هو)
  perform private.notify(p.id, 'quality_unlocked', 'فُتح سجلُّ تقييمٍ للتعديل', v_label || ' — صحّحه ثم احفظه',
                         '/quality', 'teacher_quality_months', p_id)
     from public.profiles p where p.role = 'admin_manager' and p.status = 'active';
end;
$function$;
revoke all on function public.unlock_quality_month(uuid) from public, anon;
grant execute on function public.unlock_quality_month(uuid) to authenticated;
