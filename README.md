# SvelteKit

Everything you need to build a Svelte project, powered by [`create-svelte`](https://github.com/sveltejs/kit/tree/master/packages/create-svelte), deployed to [Vercel](https://vercel.com).

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fvercel%2Ftree%2Fmain%2Fexamples%2Fsveltekit&project-name=sveltekit-vercel&repository-name=sveltekit-vercel&demo-title=SvelteKit%20%2B%20Vercel&demo-description=A%20SvelteKit%20app%20optimized%20Edge-first.&demo-url=https%3A%2F%2Fsveltekit-template.vercel.app%2F)

_Live Example: https://sveltekit-template.vercel.app_

## Developing

Once you've installed dependencies with `pnpm install`, start a development server:

```bash
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

## Building

To create a production version of your app:

```bash
pnpm run build
```

You can preview the production build with `npm run preview`.

## Environment variables

Create `.env.local` and set:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ALIAS_DOMAIN=webhookmail.mmoat.io
```

`VITE_ALIAS_DOMAIN` controls the domain suffix for generated aliases.

## Database schema and RLS

Run this SQL on Supabase:

```
create extension if not exists citext;

create table if not exists public.aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address citext not null unique,
  created_at timestamptz not null default now()
);

alter table public.aliases enable row level security;

create policy "select own aliases" on public.aliases
  for select to authenticated using (user_id = auth.uid());

create policy "insert own alias" on public.aliases
  for insert to authenticated with check (user_id = auth.uid());

create policy "delete own alias" on public.aliases
  for delete to authenticated using (user_id = auth.uid());

-- email_messages table should already exist with columns at least:
-- to_address text/citext, from_address text, subject text, received_at timestamptz
alter table public.email_messages enable row level security;

-- If your schema uses an array of recipients `to_addresses text[]`, use ANY(...)
create policy "select messages for user aliases" on public.email_messages
  for select to authenticated using (
    exists (
      select 1 from public.aliases a
      where a.address = any(public.email_messages.to_addresses)
        and a.user_id = auth.uid()
    )
  );

create or replace view public.email_messages_view as
select m.* from public.email_messages m;
```

The frontend:
- `routes/aliases/+page.svelte` lets users create and list aliases.
- `routes/messages/+page.svelte` lists messages filtered by RLS via `email_messages_view`.
