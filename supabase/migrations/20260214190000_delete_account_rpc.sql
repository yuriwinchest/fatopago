-- Create a function to allow users to delete their own account
create or replace function delete_own_account() returns void language plpgsql security definer
set search_path = public as $$
declare current_user_id uuid;
begin current_user_id := auth.uid();
if current_user_id is null then raise exception 'Not authenticated';
end if;
-- Soft delete or Hard delete?
-- Request said "delete everything".
-- Deleting from auth.users cascades to profiles if FK is set up correctly.
-- If not, we manually delete from profiles first.
delete from public.profiles
where id = current_user_id;
delete from auth.users
where id = current_user_id;
end;
$$;
-- Grant execute permission to authenticated users
grant execute on function delete_own_account to authenticated;