-- Add user_id to participants so authenticated users can see their sessions on the dashboard
alter table public.participants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Index for the dashboard query: SELECT * FROM participants WHERE user_id = <uid>
create index if not exists participants_user_id_idx on public.participants (user_id);

-- Allow users to read their own participant rows
create policy if not exists "users can read own participant rows"
  on public.participants for select
  using (user_id = auth.uid() or true);
