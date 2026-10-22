-- تعديلُ الطالب (بياناته وإسنادُه للحلقة) ليس من صلاحيات المدير الفنيّ (قرار المستخدم 2026-10-22) — يطّلع فقط.
drop policy students_update on public.students;
create policy students_update on public.students for update to authenticated
  using (
    public.current_user_role() is distinct from 'technical_manager'
    and (public.is_admin_manager()
      or (halaqa_id is not null and (public.can_assign_in_halaqa(halaqa_id) or public.is_halaqa_teacher(halaqa_id)))
      or (halaqa_id is null and (public.in_admin_scope(gender)
          or (public.current_user_role() = 'field_supervisor'
              and gender = (select p.gender from public.profiles p where p.id = (select auth.uid()))))))
  )
  with check (
    public.current_user_role() is distinct from 'technical_manager'
    and (public.is_admin_manager()
      or (halaqa_id is not null and (public.can_assign_in_halaqa(halaqa_id) or public.is_halaqa_teacher(halaqa_id)))
      or (halaqa_id is null and (public.in_admin_scope(gender) or public.current_user_role() = 'field_supervisor')))
  );
