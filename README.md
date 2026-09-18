# SignalChainDB Web

Launch-oriented Next.js application for a source-backed music gear compatibility database.

## Launch-ready features
- searchable gear database and product pages
- compatibility checker
- full Rig Builder with power/output analysis
- browser autosave and shareable rig links
- optional Supabase email/password accounts
- cloud-saved rigs with row-level security
- account, login, and password-reset pages
- retailer/affiliate shopping panels on product pages
- supporter checkout CTA via a hosted payment link
- affiliate disclosure, privacy policy, terms, contact, and partner pages
- sitemap, robots, manifest, structured Product data, and health endpoint
- optional GA4 hook
- PR/build verification workflow

## Local development
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Production environment
Copy `.env.example` and set the values that apply.

Required for public canonical URLs:
- `NEXT_PUBLIC_SITE_URL`

Required only if account/cloud-save features are enabled:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Monetization:
- `NEXT_PUBLIC_SUPPORTER_CHECKOUT_URL` — hosted checkout/payment link
- `NEXT_PUBLIC_SUPPORTER_PRICE_LABEL` — display label, e.g. `$39 one-time`
- `NEXT_PUBLIC_REVERB_AFFILIATE_TEMPLATE` — approved affiliate deep-link template
- `NEXT_PUBLIC_SWEETWATER_AFFILIATE_TEMPLATE` — optional retailer/affiliate deep-link template

Affiliate templates may use `{url}` (encoded destination), `{raw_url}`, and `{query}`.

Optional:
- `NEXT_PUBLIC_CONTACT_EMAIL`
- `NEXT_PUBLIC_GA_ID`

## Supabase launch setup
1. Create the project.
2. Run `supabase/migrations/0001_core.sql`.
3. Run `supabase/migrations/0002_users_and_saved_rigs.sql`.
4. Add the project URL and publishable/anon key to the deployment environment.
5. Set the Supabase Site URL to the production site and allow production redirects for `/account` and `/reset-password`.

The catalog remains bundled, so accounts can be enabled without migrating the product catalog first.

## Monetization launch setup
### Affiliate revenue
Reverb operates a website affiliate program through Awin. Apply, then use the approved tracked deep-link format in `NEXT_PUBLIC_REVERB_AFFILIATE_TEMPLATE`. Until a tracked template is configured, product pages use normal retailer search links and do not represent them as tracked referrals.

### Supporter revenue
Create a hosted payment link and put it in `NEXT_PUBLIC_SUPPORTER_CHECKOUT_URL`. Stripe Payment Links are one no-code option.

## Deployment
Designed for Vercel or another Next.js 16 host.

Before production traffic:
1. set `NEXT_PUBLIC_SITE_URL`
2. connect Supabase if accounts/cloud saves should be active
3. add the supporter checkout link
4. add approved affiliate tracking templates
5. add a contact email
6. deploy
7. verify `/api/health`, `/sitemap.xml`, sign-up/sign-in, a cloud rig save, and an outbound retailer link
