# PID — Deployment Guide

Production deploy guide for **Parent Intelligence Dashboard (PID)** on Vercel + Supabase Cloud.

---

## 1. Prerequisites

You need accounts + credentials for:

| Service | What you need | Where |
|---|---|---|
| **Vercel** | Account + CLI installed | https://vercel.com |
| **Supabase** | New project + URL + anon key + service-role key | https://supabase.com |
| **Anthropic** | Production API key | https://console.anthropic.com |
| **MoMo** (optional, prod) | Production partner code + secret | https://developers.momo.vn |
| **VNPAY** (optional, prod) | Production TMN code + secret | https://sandbox.vnpayment.vn → graduate to production |
| **Upstash** (optional) | Redis REST URL + token for rate limits | https://upstash.com |
| **Resend** (optional) | API key for weekly emails | https://resend.com |

Install the Vercel CLI once:

```bash
npm install -g vercel
vercel login
```

---

## 2. Supabase setup (production)

### 2.1 Create the project

1. Go to https://supabase.com → **New project** in any region (closest to Vietnam: **Singapore**)
2. Save the project URL, anon key, and service-role key from **Project Settings → API**.

### 2.2 Apply the schema

Open **SQL Editor → New query**, paste the entire contents of:

```
supabase/migrations/0001_init.sql
```

…and run it. This creates every table, RLS policy, trigger (auto-profile on signup, auto share_code on quiz insert) and seeds `credit_packs`.

> The SQL is idempotent for the `do $$ ... exception when duplicate_object` enum blocks but the table `CREATE`s will fail if rerun against an existing schema — that's expected, run it once on a fresh DB.

### 2.3 Create Storage buckets

**Storage → New bucket**:

| Bucket | Public | Notes |
|---|---|---|
| `quiz-sources` | **No** (private) | PDF uploads from `/quiz/create` and `/teacher/upload`. Max 10 MB enforced server-side. |
| `avatars` | **Yes** (public) | Profile + child avatar images. Max 2 MB recommended via CORS rule. |

After creating each, add a permissive RLS policy for authenticated users (the SQL migration covers `profiles`/`children` rows; the bucket policies are configured in the Supabase UI).

### 2.4 Enable Google OAuth (optional)

**Authentication → Providers → Google → Enable** and paste your OAuth client credentials. Add the redirect URL:

```
https://YOUR_PROD_DOMAIN/callback
```

(and `http://localhost:3000/callback` if you also need dev OAuth).

### 2.5 Create a teacher account

After signing up your first user via the app, go to **Table Editor → profiles** and change that row's `role` from `parent` to `teacher` so you can access `/teacher`.

---

## 3. Vercel deploy

### 3.1 First deploy via CLI

From the project root (`pid-web/`):

```bash
cd pid-web
vercel              # interactive — link to your team & project
vercel --prod       # promote to production
```

The first `vercel` run will ask you to confirm project settings — the bundled `vercel.json` already pins:

- `framework: nextjs`
- `regions: ["sin1"]` (Singapore — lowest latency to Vietnam)
- `outputDirectory: .next`
- Per-route `maxDuration` overrides for AI / PDF endpoints

### 3.2 Environment variables

Set ALL of the following under **Project Settings → Environment Variables** (Production + Preview).
Mark every key without the `NEXT_PUBLIC_` prefix as **server-side only**.

| Variable | Required | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Supabase → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Supabase → API → service_role (KEEP SECRET) |
| `ANTHROPIC_API_KEY` | ✓ | Anthropic console |
| `ANTHROPIC_COACH_MODEL` | optional | `claude-sonnet-4-5` (default) |
| `GOOGLE_CLOUD_API_KEY` | optional | For OCR via `/api/pdf/ocr` |
| `GOOGLE_CLOUD_PROJECT_ID` | optional | Same |
| `MOMO_PARTNER_CODE` | ✓ for payments | MoMo merchant portal |
| `MOMO_ACCESS_KEY` | ✓ for payments | MoMo merchant portal |
| `MOMO_SECRET_KEY` | ✓ for payments | MoMo merchant portal (KEEP SECRET) |
| `MOMO_API_URL` | ✓ for payments | `https://payment.momo.vn/v2/gateway/api/create` (prod) |
| `MOMO_RETURN_URL` | ✓ for payments | `https://YOUR_DOMAIN/payment/success?provider=momo` |
| `MOMO_NOTIFY_URL` | ✓ for payments | `https://YOUR_DOMAIN/api/payment/webhook?provider=momo` |
| `VNPAY_TMN_CODE` | ✓ for payments | VNPAY merchant portal |
| `VNPAY_HASH_SECRET` | ✓ for payments | VNPAY merchant portal (KEEP SECRET) |
| `VNPAY_URL` | ✓ for payments | `https://pay.vnpay.vn/vpcpay.html` (prod) |
| `VNPAY_RETURN_URL` | ✓ for payments | `https://YOUR_DOMAIN/payment/success?provider=vnpay` |
| `UPSTASH_REDIS_REST_URL` | optional | Upstash Redis details |
| `UPSTASH_REDIS_REST_TOKEN` | optional | Same — without this, rate limits become no-ops |
| `RESEND_API_KEY` | optional | Resend dashboard |
| `RESEND_FROM_EMAIL` | optional | e.g. `noreply@pid.vn` |
| `ZALO_OA_ACCESS_TOKEN` | optional | Zalo Official Account console |
| `NEXT_PUBLIC_APP_URL` | ✓ | `https://YOUR_DOMAIN` |
| `NEXT_PUBLIC_APP_NAME` | optional | `PID` |

After adding env vars, **trigger a fresh deploy** so they take effect:

```bash
vercel --prod
```

### 3.3 Custom domain (pid.vn)

1. **Project Settings → Domains → Add** → enter `pid.vn` and `www.pid.vn`.
2. Vercel shows the DNS records needed:
   - Apex `pid.vn` → A record `76.76.21.21`
   - `www.pid.vn` → CNAME `cname.vercel-dns.com`
3. Set these at your registrar (Tenten / Nhân Hòa / Cloudflare, whatever you use).
4. Wait for DNS propagation (usually 5–30 minutes) — Vercel auto-issues a Let's Encrypt cert.
5. Update `NEXT_PUBLIC_APP_URL`, `MOMO_RETURN_URL`, `MOMO_NOTIFY_URL`, `VNPAY_RETURN_URL` to the new domain, then redeploy.
6. Add the production OAuth redirect (`https://pid.vn/callback`) in Supabase **Authentication → URL Configuration** + Google Cloud Console OAuth client.

---

## 4. Post-deploy smoke test

Run this checklist on the live URL before announcing:

- [ ] **Auth — email** — register a new account → click email confirmation link → land on `/` dashboard.
- [ ] **Auth — Google** — sign in via Google → callback redirects to `/`.
- [ ] **Onboarding** — add a child profile via `/settings` → name + grade saved.
- [ ] **Score input** — `/input`: try entering `15` → red border + validation; enter `7.5` → green border; submit → toast + dashboard auto-refreshes.
- [ ] **AI analyze** — after scores saved, dashboard KPIs populate (or fall back to mock-data analysis with the "Đang dùng dữ liệu mẫu" notice if `ANTHROPIC_API_KEY` is missing).
- [ ] **Quiz generate** — `/quiz/create`: paste 200+ chars text → step through wizard → generate → quiz row appears in `/quiz`.
- [ ] **PDF upload** — upload a real PDF (≤10 MB) at `/quiz/create` step 1 → text extracted → if extracted text < 100 chars, see "PDF là ảnh scan" message.
- [ ] **Quiz play** — open generated quiz → answer using keys `1`/`2`/`3`/`4` + `Enter` → submit → score appears. Close tab mid-quiz then reopen → draft restored from `localStorage`.
- [ ] **AI Coach** — `/coach`: streaming response arrives chunk-by-chunk → suggestion pills appear under reply → click switches conversation.
- [ ] **Payment** — `/settings` → "Nâng cấp Premium" → MoMo or VNPAY redirect → complete in sandbox → return to `/payment/success` → plan updated in `profiles`.
- [ ] **Teacher** — flip your `profiles.role` to `'teacher'` → access `/teacher` → upload PDF → publish → modal shows QR + Zalo template → open `/q/<shareCode>` in an incognito window → public quiz works without login → submit → see signup CTA.
- [ ] **Notification bell** — insert a row into `alerts` for your child via SQL → badge updates **live** (Realtime).
- [ ] **Rate limit** — hit `/api/ai/coach` 21 times within an hour → 21st returns `429` (only triggers when Upstash configured).
- [ ] **Lighthouse** — Performance ≥ 80 on dashboard, Accessibility ≥ 90 across all key pages.

---

## 5. Operations

### Logs
- **Vercel** → Project → Deployments → click deploy → Functions tab for serverless logs.
- **Supabase** → Logs Explorer for DB/auth logs.

### Rolling back
```bash
vercel rollback                  # promotes the previous production deploy
vercel rollback <deployment-url> # specific one
```

### Updating the schema later
For schema changes, add a new file `supabase/migrations/0002_*.sql` and run it in the SQL editor. Then regenerate `types/database.ts` if you start using generated types:

```bash
npx supabase gen types typescript --project-id YOUR_REF > types/database.ts
```

### Cost monitoring
- Anthropic: check usage daily for the first week — Coach streaming + quiz-generate are the costly endpoints.
- Vercel: enable Spend Management to cap function execution + bandwidth.
- Supabase: free tier covers ~50k MAU for auth; storage/egress are the first walls.

---

## 6. Known production caveats

- **MoMo / VNPAY production credentials** are only issued after KYC. While waiting, the routes auto-fall-back to mock redirects if env keys start with `your_…` or are unset — production users would just see a 200 success page with `mock=1` in the URL. Make sure real credentials are in place before announcing payment support.
- **Anthropic streaming on Edge** — the Coach route runs `edge` runtime. If you see cold-start latency >1s in `sin1`, lower it by hitting the route during deploy or switching to `nodejs` runtime in `app/api/ai/coach/route.ts`.
- **pdf-parse** runs Node-only (it loads the PDF.js worker). The `/api/pdf/upload` route is already pinned to `runtime = "nodejs"` — don't touch that.
- **Service-role key** is used only by webhooks (`/api/payment/webhook`) and the public quiz page (`/q/[shareCode]`). If you leak it, rotate **immediately** in Supabase → API → Reset.

---

## 7. Quick redeploy

After any code change:

```bash
git push                         # if connected to Vercel via Git
# or
vercel --prod                    # if deploying via CLI
```

Vercel will rebuild, run typecheck via Next, and atomically swap traffic when the new deploy is ready.
