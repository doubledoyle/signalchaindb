# SignalChainDB Web

Production-oriented Next.js starter for SignalChainDB.

## Included now
- Next.js 16.3.3 App Router
- 141-product v0.3 dataset bundled for immediate local development
- homepage
- searchable/filterable `/gear` catalog
- statically generated `/gear/[slug]` product pages
- `/compatibility` checker
- early `/rig-builder`
- source/confidence labels
- product image metadata support (`image_url`, `image_source`, `image_credit`)
- Supabase/Postgres migration starter
- `.env.example` for the eventual Supabase connection
- React 19.2.7 + Next.js 16.3.3 (Active LTS)

## Run locally
```bash
npm install
npm run dev
```
Then open http://localhost:3000.

## Product images
Product records can optionally include:
- `image_url` — local `/public/...` path or hosted image URL
- `image_source` — page where the image originated
- `image_credit` — manufacturer/photographer/source credit

The catalog renders a branded placeholder when no image has been added yet, so image coverage can be expanded gradually without breaking the UI.

For production, prefer optimized WebP/AVIF files stored separately from the JSON dataset, with only image metadata kept in product records. Use images you have permission to publish and preserve source/credit information.

## Why local JSON first?
It lets the site build and deploy immediately while the production Supabase project is being created. The UI is deliberately isolated from storage so `lib/data.ts` can later be swapped to server-side Supabase queries without rebuilding the product.

## Production migration
1. Create a Supabase project.
2. Install `@supabase/ssr` and `@supabase/supabase-js`, following Supabase’s current Next.js SSR setup.
3. Run `supabase/migrations/0001_core.sql`.
4. Import the existing product/compatibility/source records.
5. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
6. Replace local data loaders with server-side Supabase queries.
7. Add auth, saved rigs, user reports, and affiliate/price tables.

## Deployment
Designed for Vercel or another Next.js host.
