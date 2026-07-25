# Sentinel Console + Demo Test Runner — what was built and how to run it

Companion to `DEMO_PRESENTATION.md`. That document is the stage script; this one
is the machinery: the in-app screens for the watchers that have no banking flow,
the login-page button panel that runs the automated scripts, and the Playwright
suite itself.

> **Read §5 before you present.** Three of the four watchers do not behave the
> way `DEMO_PRESENTATION.md` describes. Everything here is measured against the
> running model, not assumed.

---

## 1. What is new

| Area | Path | What it does |
|---|---|---|
| Model proxy | `apps/backend/src/sentinel/` | `POST /api/sentinel/score`, `GET /api/sentinel/ready`, `GET /api/sentinel/metrics`. Lets the **browser** reach the model. |
| Test runner | `apps/backend/src/demo-tests/` | `POST /api/demo-tests/run`, SSE `GET /api/demo-tests/stream/:runId`. Spawns Playwright. Only mounts when `DEMO_TEST_RUNNER=true`. |
| Sentinel Console | `apps/frontend/app/(app)/sentinel/page.tsx` | One page, three tabs: Intrusion, Future-Proofing, Command Center. |
| Verdict card | `apps/frontend/components/sentinel/VerdictCard.tsx` | Risk badge, score, band edges, reasons, per-watcher contribution bars, raw JSON. |
| Presets / types | `apps/frontend/lib/sentinel.ts` | Scenario presets and the fitted band edges shown in the UI. |
| Runner panel | `apps/frontend/components/demo/DemoTestPanel.tsx` | The buttons on `/login`. Streams live output. |
| Playwright suite | `playwright.config.ts`, `tests/` | 7 spec files, 38 tests. At the **simulator root** — not a separate workspace. |
| Env helper | `scripts/print-demo-env.js` | `npm run e2e:env` prints the exact export block the backend needs. |

Two existing files changed:

- `apps/frontend/lib/nav.ts` — one new sidebar entry, **Sentinel Console**.
- `apps/frontend/app/(app)/layout.tsx` — **bug fix**, see §6.

---

## 2. Why the proxy exists

The FastAPI model service mounts **no CORS middleware** (there is no
`add_middleware(CORSMiddleware, …)` anywhere in `sentinel_fusion_ai/service`), so
a `fetch('http://localhost:8000/score')` from the Next.js app is blocked by the
browser before it leaves the tab. Proxying through the bank also keeps the model
API key server-side instead of shipping it to the client.

The proxy does **not** go through `FraudGateway`: nothing on the console writes a
`FraudEvent`, touches the ledger, or pollutes the analyst feed.

---

## 3. Running it

### 3.1 Start the stack

```bash
cd Finspar-X-Bank-Simulator

npm install
npx playwright install chromium

npm run up                                   # postgres on host port 5433
npm run db:migrate
npm run db:seed

# the model, from the sibling project
docker start sentinel_fusion_ai-api-1        # or: cd ../sentinel_fusion_ai && docker compose up -d
curl http://localhost:8000/ready             # -> {"ready":true,...}
```

### 3.2 The backend environment — the part that actually bites

**`apps/backend` has no dotenv loader.** No `ConfigModule`, no `dotenv` import;
`src/common/env.ts` reads `process.env` directly. Writing `apps/backend/.env`
does **not** reliably reach the code that chooses the scorer. Export it:

```bash
eval "$(npm run --silent e2e:env)"
npm run dev:backend:demo      # tees stdout to .artifacts/backend.log
```

`npm run e2e:env` prints, with explanations:

| var | default | must be | why |
|---|---|---|---|
| `SENTINEL_ENABLED` | `false` | `true` | false binds the Phase-1 `HeuristicScorer`; the ML model is never called |
| `SENTINEL_URL` | `host.docker.internal:8000` | `http://127.0.0.1:8000` | host-run Node resolves `localhost` to IPv6 and times out |
| `SENTINEL_TIMEOUT_MS` | `800` | `15000` | the cold SHAP call takes ~6s; on timeout `HttpScorer` **silently falls back to the heuristic** |
| `GEO_ALLOW_MOCK_COUNTRY` | `false` | `true` | false makes the login page's mock-VPN selector a no-op |
| `OTP_TTL_SECONDS` | `100` | `900` | the hold → release → authorize flow outlives 100s |
| `JWT_EXPIRES_IN` | `15m` | `60m` | long UI specs outlive 15m |
| `DEMO_TEST_RUNNER` | `false` | `true` | mounts the login-page runner routes |

`dev:backend:demo` tees to `.artifacts/backend.log`. That log is **not cosmetic** —
the test suite reads it to prove the model was actually called (§4.3).

### 3.3 Frontend

```bash
NEXT_PUBLIC_DEMO_TEST_RUNNER=true npm run dev:frontend
```

Without that variable the login page renders normally with no test panel. The
panel also hides itself if the backend runner is not mounted, so the two flags
can never disagree visibly.

---

## 4. The three surfaces

### 4.1 Sentinel Console — `/sentinel`

Sidebar → **Sentinel Console**. Three tabs, each with a scenario preset, editable
fields, a Send button and a verdict card.

- **Intrusion Watcher** — send a network event. Preset: 9 MB out to port 4444 in
  a 1.2s burst → **CRITICAL**.
- **Future-Proofing Watcher** — send a certificate record. Preset 1: secret data
  behind RSA-2048 on a 10-year cert → **CRITICAL**. Preset 2: same certificate,
  `internal` data → **LOW**. That second preset is the contrast beat that
  genuinely works (§5.3).
- **Command Center** — fires one event at each of the four watchers and shows
  which single contribution lit up for each, plus the live
  `sentinel_scored_total` counters straight from the model's `/metrics`.

Every card shows the **fitted band edges** for that model, so a verdict reads as
a documented threshold rather than a magic number.

### 4.2 Demo test runner — the buttons on `/login`

Five buttons (one per watcher) plus **Test all scripts**. Clicking one POSTs to
`/api/demo-tests/run`, then an `EventSource` streams the Playwright output into a
scrolling log with a pass/fail badge and a duration.

Safety, since these routes are unauthenticated (the panel is pre-auth and
`EventSource` cannot send headers):

1. The whole module only registers when `DEMO_TEST_RUNNER=true`. Off by default,
   the routes **404** — they do not exist rather than existing-but-refusing.
2. `spec` is looked up in a fixed `SPEC_MAP`. Anything else is a `400` before
   anything is spawned. Verified: `../../etc/passwd`, `money; rm -rf /`, `""`.
3. `execFile` with an **argv array** and `shell: false` — no shell, so no
   metacharacter in any input can be interpreted.
4. Single-run mutex (`409` on a second run), a 5-minute wall-clock kill, and a
   bounded in-memory log.

**Never enable `DEMO_TEST_RUNNER` outside a demo machine.**

### 4.3 The Playwright suite

At the simulator root, `tests/`, deps in the root `package.json`. No new
workspace.

```
playwright.config.ts
tests/
  global-setup.ts
  helpers/  env  api  sentinel  ui  ids  model-guard  backend-log  fixtures
  specs/
    01-money-watcher.spec.ts      [ui]   drain -> BLOCKED; governance -> HELD -> release -> send
    02-habits-watcher.spec.ts     [ui]   mock-VPN country reaches the model; login scored not blocked
    03-intrusion-watcher.spec.ts  [api]  cyber -> critical + contract guards
    04-quantum-watcher.spec.ts    [api]  quantum critical/low + the real lever
    05-command-center.spec.ts     [api]  routing, envelope, calibration ordering
    06-sentinel-console.spec.ts   [ui]   the console screens themselves
    07-demo-runner-panel.spec.ts  [ui]   the panel + runner allowlist
```

```bash
npm run e2e          # everything
npm run e2e:api      # model only — no bank needed at all
npm run e2e:ui       # browser specs
npm run e2e:demo     # just the @demo-tagged stage beats
npm run e2e:report   # open the HTML report
```

**Guards worth knowing about**

- **Fail-open detection.** `HttpScorer` catches every error and silently returns
  `HeuristicScorer` output, so a HELD payment from the heuristic looks identical
  to one from XGBoost. Three layers catch it: a blocklist of the heuristic's
  literal reason strings; an exact count of `[Sentinel /score]` lines in
  `.artifacts/backend.log` around each action; and an auto-use fixture that fails
  any test during which the backend logged `failing open to heuristic`.
- **Not the model's metrics counter.** The service runs `uvicorn --workers 2` and
  `prometheus_client` counters are per-process, so consecutive `/metrics` scrapes
  hit different workers and disagree — measured, alternating between 7 counter
  rows and 0 on an idle service. It is used as a positive-only signal; the exact
  counting is done from the backend log.
- **Feature-store flush is the default.** The behaviour model learns: once NL has
  been seen for a user it is never "new" again. `global-setup` runs
  `redis-cli FLUSHALL` against the model's store unless you pass
  `E2E_KEEP_FEATURE_STORE=1`.
- **Preflight fails loudly.** Model down, Postgres down, frontend down,
  `SENTINEL_ENABLED` off, or `GEO_ALLOW_MOCK_COUNTRY` off each abort the run with
  the exact command that fixes it, instead of a red spec 40 seconds in.

---

## 5. ⚠️ What the models actually do

All measured against the running bundle (`model_version: dev`,
`contract_hash: ec65b4e5353c0928`). The fitted band edges come from
`models/fusion_engine.joblib` → `FusionEngine.bands`:

| model | low < | medium < | high < | critical ≥ |
|---|---|---|---|---|
| `fraud_payment` | 0.0138 | 0.0396 | 0.2430 | 0.2430 |
| `cyber` | 0.0069 | 0.1559 | 0.1837 | 0.1837 |
| `behaviour` | 0.0574 | 0.1148 | 0.4074 | 0.4074 |
| `quantum` | *no fitted bands — falls back to 0.25 / 0.50 / 0.75* |

These are fitted at cost-optimal thresholds, which is why a `fraud_payment` score
of 0.044 is genuinely "high". **Never assert on the raw number — only the band.**

### 5.1 ✅ Money Watcher — works, but not as scripted

It discriminates properly, and returns the doc's own plain-language reasons
("beneficiary was added 2 minutes ago", "amount is 8x this customer's normal
spend"). But the two beats in §6 of the demo doc are **different scenarios**:

```
brand-new payee, first ever payment   -> CRITICAL -> BLOCKED (account frozen, case opened)
established payee, off-pattern amount -> HIGH     -> HELD    (analyst queue)
```

The doc says the drain lands on HELD and is then released by an authorizer. It
does not. Swept through the real bank flow at ₹25k / 50k / 100k / 150k / 250k, a
payee added minutes ago returned **critical every time**. Notably the doc's exact
demo amount, ₹2,50,000, scores `0.2429906576871872` against a critical edge of
`0.242990642786026` — over by **1.5e-8**, i.e. sitting precisely on the boundary.

**On stage:** present the drain as the "no money moved, account frozen" beat, and
use an **established payee** for the governance beat (hold → authorizer releases →
send). Both are covered by `01-money-watcher.spec.ts`.

### 5.2 🔴 Intrusion Watcher — saturated, always critical

`DEMO_PRESENTATION.md` §8.4 promises `bytes_out: 2000, dst_port: 443` → **low**.
Measured, everything returns **critical**:

```
benign 1200B in / 800B out, ports 443/80/22/53/8080/4444 -> 0.9961 critical (identical)
dns udp/53 tiny payload                                  -> 1.0000 critical
ssh login, zero bytes                                    -> 1.0000 critical
minimal event, no network fields                         -> 0.1640 high
```

Not a cold-start artifact — after warming a host with 12 benign `/ingest` events
until `degradation: {degraded:false, user_history:false}`, benign still scored
0.9961. "Low" needs `risk_score < 0.0069`; nothing produced it.

**On stage:** show the malicious event only. If a judge asks for the benign
re-run, say plainly that this head is currently over-sensitive and point at the
Future-Proofing tab for a contrast that works. The Console carries this warning
inline so nobody is caught out. Test: `03-intrusion-watcher.spec.ts` asserts the
critical verdict and keeps the contrast as a visible `test.fixme`.

### 5.3 🔴 Future-Proofing Watcher — only `q_data_class` matters

§9.4 claims sensitivity × algorithm weakness × certificate lifetime, and that
Kyber + 90 days → low. Algorithm and validity have **zero** effect:

```
RSA-2048 / internal / 90d   -> 0.0000 low      Kyber / internal / 90d   -> 0.0000 low
RSA-2048 / internal / 3650d -> 0.0000 low      Kyber / internal / 3650d -> 0.0000 low
RSA-2048 / secret   / 90d   -> 0.9000 critical Kyber / secret   / 90d   -> 0.9000 critical
RSA-2048 / secret   / 3650d -> 0.9000 critical Kyber / secret   / 3650d -> 0.9000 critical
```

Output is binary on the data classification. **Rotating to post-quantum crypto
does not lower the score.**

**On stage:** the contrast beat is real, but flip **`q_data_class`** (secret →
internal), not the algorithm. That is exactly what the Console's second preset
does.

### 5.4 🔴 Habits Watcher — the country has no effect

§7 claims a new-country login seconds after a domestic one is scored HIGH on
impossible travel, with the reason "unusual new country for this customer".
Controlled experiment, feature store flushed, two fresh users each given one
prior IN login, then a second login one second later:

```
run 1:  A 2nd login IN -> 0.345132     B 2nd login NL -> 0.188230
run 2:  A 2nd login NL -> 0.345132     B 2nd login IN -> 0.345132
```

Identical inputs bar the country give identical scores, and the *foreign* login
scored lower as often as higher. The variation tracks `f_user_secs_since_last`
(sub-second timing), not `f_user_new_country` — which never appeared in the top
SHAP features. `explanation.reasons` came back **empty** for every established
user. Separately, with 60 logins of history a perfectly normal home login also
scores `high` (0.1882), because the behaviour head's high band starts at 0.1148.

**On stage:** demo it as "the login is scored and recorded in real time, and the
location it came from is part of that score" — which is true and visible. Do not
promise that the foreign login scores higher. `02-habits-watcher.spec.ts` asserts
the plumbing (the mock country reaches the model, the login is scored not
blocked) and keeps the country-raises-risk claim as a documented `test.fixme`.

---

## 6. Bug fixed along the way

`app/(app)/layout.tsx` ran its auth guard on the first client render, before
zustand's `persist` middleware had rehydrated from `localStorage`. `token` was
still `null`, so it redirected to `/login`. In-app navigation hid this (the store
is already in memory), but **any full page load — a deep link, F5, or a shared
URL — bounced a perfectly valid session to the login screen.** The guard now
waits for `persist.hasHydrated()`.

---

## 7. Verifying it end to end

```bash
# 1. everything
npm run e2e
#    -> 36 passed, 2 skipped
#    The 2 skips are the deliberate fixmes in §5.2 and §5.4.

# 2. model only, no bank required
npm run e2e:api          # 20 passed, 1 skipped

# 3. the console, by hand
#    /sentinel -> Intrusion -> Send            => CRITICAL
#              -> Future-Proofing -> Send      => CRITICAL
#                 switch preset to "internal"  => LOW
#              -> Command Center -> Fire       => four cards, one contribution each

# 4. the runner, by hand
#    /login -> Future-Proofing Watcher         => streams, ends "PASSED in ~5s"
#    click a second button mid-run             => 409, buttons disabled

# 5. prove the guards work
E2E_SENTINEL_URL=http://127.0.0.1:9999 npx playwright test tests/specs/04-quantum-watcher.spec.ts
#    -> E2E PREFLIGHT FAILED, "The Sentinel model service is unreachable", with fixes

# 6. prove the runner is off by default
#    restart the backend without DEMO_TEST_RUNNER=true
curl -i http://localhost:3001/api/demo-tests/specs      # -> 404
```

Run the suite twice in a row — it should pass both times. Determinism comes from
`prisma:seed` plus a customer-status reset in `global-setup`, per-run unique
`custRefNo`/beneficiary codes, the Redis flush, and IMPS-only payments (NEFT and
RTGS would hit the 19:30 cut-off and return `HELD_CUTOFF`, masking a fraud hold).

---

## 8. Corrections to `DEMO_PRESENTATION.md`

1. **§6.5 step 12** — "Go to Payments, open the payment, Authorize & Send". No
   such route. It is `/payments/modify`, **nothing loads until `Search` is
   clicked**, and the action is an icon-only button (`title="Authorize & Send"`),
   disabled unless the status is `NEW`/`PENDING_AUTH`/`HELD`.
2. **§6.3 step 7** — the drain's outcome is **BLOCKED**, not HELD (§5.1).
3. **§6.3 step 6** — "Rail IMPS" is not a field on the payment form. The rail is
   a mode-gate screen rendered *before* the form, and the IMPS card's accessible
   name is `IMPS IMPS` (label + badge).
4. **§4** — PRIYA_A's password is `Finspark@123` in `prisma/seed.ts`, not
   `NewPass@999`. The seed uses `upsert(update: {})`, so a password changed
   through the UI survives every reseed; the suite resolves it at runtime.
5. **§7.3 step 5** — the reason "unusual new country for this customer" does not
   appear; reasons come back empty for established users (§5.4).
6. **§8.4 and §9.4** — both contrast beats are wrong as written (§5.2, §5.3).
7. **§11** — "assert the toast contains `HELD`": the UI never renders that
   string. A fraud hold reads `Funds held for analyst review`; a cut-off hold
   reads `Funds held — <reason>`. The em-dash is the discriminator.
8. **§3** — putting the Sentinel variables in `apps/backend/.env` is not enough;
   there is no dotenv loader. Export them (§3.2).
