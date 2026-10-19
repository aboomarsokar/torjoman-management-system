-- ═══════════════════════════════════════════════════════════════════════════
-- كشف الحوافز بلا المدير الفني (قرار المستخدم 2026-10-19)
-- ───────────────────────────────────────────────────────────────────────────
-- كانت مراجعة الكشوف تمرّ بـ can_approve_in_halaqa — وهي نفسها التي تمنح المدير الفني اعتماد
-- التقارير الشهرية (ويبقى له). فتُفصل هنا دالّةٌ للكشوف بقائمةٍ موجبة صريحة:
--   • المراجعة والاعتماد: المدير الإداري، والمديرة الإدارية لحلقات البنات.
--   • القراءة: معلّم الحلقة، ومشرف المشروع (اطّلاعاً)، ومن يراجع.
-- قائمةٌ موجبة لا «الكلّ إلا الفني» — نفيُ دورٍ واحد ينكسر صامتاً مع كلّ دورٍ جديد.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.can_review_statement_in_halaqa(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.current_user_role() = 'admin_manager'
      or (public.current_user_role() = 'women_admin' and h.gender = 'female')));
$$;

create or replace function public.can_view_statements_in_halaqa(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_halaqa_teacher(hid)
      or public.is_project_supervisor()
      or public.can_review_statement_in_halaqa(hid);
$$;

revoke execute on function public.can_review_statement_in_halaqa(uuid) from public, anon;
revoke execute on function public.can_view_statements_in_halaqa(uuid) from public, anon;
grant execute on function public.can_review_statement_in_halaqa(uuid) to authenticated;
grant execute on function public.can_view_statements_in_halaqa(uuid) to authenticated;

drop policy if exists statements_select on public.incentive_statements;
create policy statements_select on public.incentive_statements for select to authenticated
  using (public.can_view_statements_in_halaqa(halaqa_id));

drop policy if exists statements_write on public.incentive_statements;
create policy statements_write on public.incentive_statements for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_review_statement_in_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_review_statement_in_halaqa(halaqa_id));

drop policy if exists sitems_select on public.incentive_statement_items;
create policy sitems_select on public.incentive_statement_items for select to authenticated
  using (exists (select 1 from public.incentive_statements st
                 where st.id = incentive_statement_items.statement_id
                   and public.can_view_statements_in_halaqa(st.halaqa_id)));

drop policy if exists sitems_write on public.incentive_statement_items;
create policy sitems_write on public.incentive_statement_items for all to authenticated
  using (exists (select 1 from public.incentive_statements st
                 where st.id = incentive_statement_items.statement_id
                   and ((public.is_halaqa_teacher(st.halaqa_id) and st.status = 'draft')
                        or public.can_review_statement_in_halaqa(st.halaqa_id))))
  with check (exists (select 1 from public.incentive_statements st
                      where st.id = incentive_statement_items.statement_id
                        and ((public.is_halaqa_teacher(st.halaqa_id) and st.status = 'draft')
                             or public.can_review_statement_in_halaqa(st.halaqa_id))));

create or replace function public.guard_statement_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not public.can_review_statement_in_halaqa(old.halaqa_id) then
      raise exception 'لا يُحذف الكشف بعد إرساله إلا بيد الإدارة' using errcode = '42501';
    end if;
    return old;
  end if;
  if public.can_review_statement_in_halaqa(new.halaqa_id)
     and (tg_op = 'INSERT' or public.can_review_statement_in_halaqa(old.halaqa_id)) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'لا يُعدَّل الكشف بعد إرساله إلا بيد الإدارة' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'لا تملك مراجعة الكشف' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' and (new.reviewed_by is not null or new.reviewed_at is not null))
     or (tg_op = 'UPDATE' and (new.reviewed_by, new.reviewed_at) is distinct from (old.reviewed_by, old.reviewed_at)) then
    raise exception 'لا تملك مراجعة الكشف' using errcode = '42501';
  end if;
  return new;
end $$;
