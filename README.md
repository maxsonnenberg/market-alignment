This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase-Datenmodell

Die Matrix liest Länder, Kategorien, Applikationen und Zuordnungen dynamisch aus Supabase. Für mehrere Applikationen in einer Zelle wird pro Zuordnung eine eigene Zeile in `country_app_assignments` gespeichert.

```sql
create table if not exists public.applications (
	id uuid primary key default gen_random_uuid(),
	name text not null unique,
	sort_order int
);

alter table public.country_app_assignments
	add column if not exists application_id uuid references public.applications(id) on delete cascade;

alter table public.country_app_assignments
	drop constraint if exists country_app_assignments_country_id_app_category_id_key;

create unique index if not exists country_app_assignments_unique_application
	on public.country_app_assignments (country_id, app_category_id, application_id);
```

Beispiel für zwei Applikationen in derselben Zelle:

```sql
insert into public.applications (name, sort_order)
values ('SAP', 1), ('SAP Business One', 2)
on conflict (name) do nothing;

insert into public.country_app_assignments (country_id, app_category_id, application_id)
select c.id, cat.id, a.id
from public.countries c
cross join public.app_categories cat
cross join public.applications a
where c.name = 'Deutschland'
	and cat.name = 'ERP'
	and a.name in ('SAP', 'SAP Business One')
on conflict do nothing;
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
