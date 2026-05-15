# Between Us — Online-ready MVP

AI-powered family communication tool for teens, young adults, and parents.

**Promise:** Say the thing without making them shut down.

## Stack

- Static landing/demo: `index.html`
- Local dev server: `server.js`
- Production serverless APIs: `api/*.js` for Vercel
- AI rewrite: OpenAI Chat Completions
- Database / waitlist / usage logging: Supabase
- Payments: Stripe Checkout
- Email: Resend

## Run locally

```bash
npm start
```

Open:

```text
http://localhost:4321
```

Do not open `index.html` directly if you want API buttons to work.

## Production APIs

- `POST /api/rewrite` — rewrites tense messages and logs usage when Supabase is configured.
- `POST /api/waitlist` — saves email to Supabase and optionally sends Resend emails.
- `POST /api/auth-start` — sends Supabase magic-link login email.
- `GET /api/me` — returns authenticated profile and Family Plus entitlement.
- `POST /api/checkout` — creates Stripe Checkout session for logged-in users only.
- `POST /api/stripe-webhook` — records Stripe events in Supabase and syncs Family Plus entitlement.
- `GET /api/health` — shows which integrations are configured.
- `POST /api/voice` — disabled in production until a hosted TTS provider is added.

## Environment variables

Copy `.env.example` to `.env` locally, and add the same variables in Vercel Project Settings.

Required for production-quality AI:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Optional but recommended:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FREE_REWRITES_PER_DAY=3
STRIPE_SECRET_KEY=
STRIPE_PRICE_FAMILY_PLUS=
RESEND_API_KEY=
RESEND_FROM_EMAIL=Between Us <hello@your-domain.com>
WAITLIST_NOTIFY_EMAIL=
PUBLIC_SITE_URL=https://your-domain.com
```

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into Vercel env vars.
5. In Supabase Auth URL Configuration, set Site URL to your production domain and add the same domain as an allowed redirect URL.

The serverless API uses the service role key for database writes; never expose the service role key in frontend JavaScript. The anon key is safe to use for Supabase Auth.

## Stripe setup

Checkout is implemented at `POST /api/checkout`.

Required server-side Checkout setup:

1. Create product: `Family Plus`.
2. Create recurring price: `$7/month`.
3. Put the price id into `STRIPE_PRICE_FAMILY_PLUS` (`price_...`).
4. Put the secret key into `STRIPE_SECRET_KEY` (`sk_live_...` or `sk_test_...`).
5. Redeploy Vercel.

Optional fastest fallback:

- Create a hosted Stripe Payment Link and set `STRIPE_PAYMENT_LINK_URL` in Vercel. The checkout API will redirect there when no secret key is configured.

Webhook endpoint is present at `/api/stripe-webhook`, records raw Stripe events in Supabase, and updates `user_profiles.plan/subscription_status`. Set `STRIPE_WEBHOOK_SECRET` after creating the Stripe webhook endpoint.

Important: checkout now requires login. Stripe sessions include `client_reference_id` and metadata with the Supabase user id, so paid access attaches to the logged-in account.

## Resend setup

1. Verify sending domain in Resend.
2. Set `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL`.
4. Optional: set `WAITLIST_NOTIFY_EMAIL` for internal alerts.

## Deploy to Vercel

```bash
git init
git add .
git commit -m "Prepare Between Us MVP for online launch"
```

Then push to GitHub and import the repo in Vercel.

Vercel will serve `index.html` and deploy `api/*.js` as serverless functions.

## Product boundary

Between Us is communication guidance, not therapy, legal advice, medical advice, or emergency support. Crisis, violence, abuse, self-harm, coercion, or immediate danger should route to qualified local support.

## Voice generation

Local prototype voice used macOS `say`, but production voice is disabled. For launch, use one of:

- OpenAI TTS
- ElevenLabs
- Google TTS
- Supabase Storage / Vercel Blob for generated files
