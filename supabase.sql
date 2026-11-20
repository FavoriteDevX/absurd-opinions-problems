-- Absurd Opinions Problems — optional shared vote counter.
-- Run this once in your Supabase project's SQL editor, then fill in assets/config.js.

create table if not exists public.vote_counts (
  topic_id text primary key check (char_length(topic_id) between 1 and 80),
  a bigint not null default 0,
  b bigint not null default 0
);

alter table public.vote_counts enable row level security;

-- Anyone can read the totals.
drop policy if exists "read vote counts" on public.vote_counts;
create policy "read vote counts" on public.vote_counts for select using (true);

-- Nobody writes to the table directly; votes go through this function only.
create or replace function public.cast_vote(p_topic text, p_side text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_side not in ('a', 'b') then
    raise exception 'side must be a or b';
  end if;
  if p_topic !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'bad topic id';
  end if;

  insert into public.vote_counts (topic_id, a, b)
  values (p_topic, (p_side = 'a')::int, (p_side = 'b')::int)
  on conflict (topic_id) do update
    set a = vote_counts.a + (p_side = 'a')::int,
        b = vote_counts.b + (p_side = 'b')::int;
end;
$$;

revoke all on function public.cast_vote(text, text) from public;
grant execute on function public.cast_vote(text, text) to anon, authenticated;
