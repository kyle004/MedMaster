# MedMaster model pricing reference

**Data source:** OpenRouter live catalog (`/api/v1/models`) plus the owner's
screenshots of the OpenRouter model pages.
**Fetched:** 2026-08-12. Prices move. Re-check before making a routing decision
that matters, and re-check *immediately* if a bill surprises you.

**What is live API data and what is not — read this once:**

| Thing | Where it came from | Trust it? |
|---|---|---|
| Text prices, context lengths | live `/api/v1/models` | yes, exact |
| Healthcare rank (1–5) | owner's ranked list from `openrouter.ai/rankings`, health category | it is a human-maintained ordering; that page hydrates client-side and has no public API, so there is nothing to fetch |
| Image `$/image` | site-displayed per-image price from the model pages, cross-checked against API pricing fields | approximate — see the methodology note in the IMAGE section |
| Image latency / throughput | model-page stats at fetch time | a snapshot, and a noisy one |
| Video `from $` | model page "from $" = **cheapest configuration** | the API returns **no** per-request video pricing at all — see the VIDEO caveat |

The live copy of this table is in `js/ai.js` as `MODEL_PRICING`, mirrored in
`netlify/functions/ai.js`. This file is the human-readable version and is what
the routing in `RECOMMENDED_AI_CONFIG` was chosen from.

---

## TEXT

Prices are **USD per 1,000,000 tokens**. Context is in tokens (`1049k` =
1,048,576, i.e. 1M).

The `params` column is only filled where it can actually be **parsed out of the
slug**. A blank means the slug does not say, and nothing here guesses:
`deepseek-v4-flash-0731` ends in a date, not a parameter count, and
`glm-5.2` / `qwen3.8-max` end in version numbers. For MoE models the slug
convention is `<total>b-a<active>b`, e.g. `550b-a55b` = **550B total, 55B
active**.

### Ranked on healthcare

| Health rank | Slug | In $/M | Out $/M | Context | Params |
|---:|---|---:|---:|---:|---|
| 1 | `deepseek/deepseek-v4-flash-0731` | 0.08 | 0.18 | 1049k | — |
| 2 | `google/gemini-3.1-flash-lite` | 0.25 | 1.50 | 1049k | — |
| 3 | `deepseek/deepseek-v4-flash` | 0.14 | 0.28 | 1049k | — |
| 4 | `z-ai/glm-5.2` | 0.49 | 1.54 | 1049k | — |
| 5 | `google/gemini-3-flash-preview` | 0.50 | 3.00 | 1049k | — |

**The one fact that decides the whole routing:** rank 1 is also, within a
rounding error, the cheapest. `deepseek-v4-flash-0731` at $0.08/$0.18 beats
every other ranked model on healthcare *and* costs a third of #2 on input and
an eighth on output. There is no tradeoff to agonise over. It is the workhorse
for every text feature on every paid tier.

The only reason to spend more is **graded feedback** — debriefs and SBAR
grading, where the student receives a judgement rather than a conversation, and
which happen once per simulation rather than once per turn. GLM 5.2 takes those
on Pro and Instructor. At a handful of calls a day, ~6x the output price is
noise; at every tutor turn it would not be.

Notes on the ranked five:

- **`deepseek-v4-flash`** (rank 3) is the *rolling latest* build. It moves under
  you without warning. `-0731` is the pinned build and is the one to route to.
- **`gemini-3-flash-preview`** (rank 5) is a preview model: it can change
  behaviour or disappear entirely. Fine in an allow-list, bad as a default.

### Other notable models (not ranked on health)

| Slug | In $/M | Out $/M | Context | Params | Why it is here |
|---|---:|---:|---:|---|---|
| `deepseek/deepseek-v4-pro` | 1.17 | 2.34 | 1049k | — | the step up from the Flash line; ~15x the input price of `-0731` |
| `tencent/hy3` | 0.13 | 0.53 | 262k | — | cheap, but 262k context and 3x the output price of `-0731` |
| `xiaomi/mimo-v2.5` | 0.14 | 0.28 | 1050k | — | priced identically to `deepseek-v4-flash`, largest context in the list |
| `google/gemini-3.6-flash` | 1.50 | 7.50 | 1049k | — | 42x the output price of the workhorse |
| `qwen/qwen3.8-max` | 2.00 | 6.00 | 1000k | — | the expensive end; nothing in MedMaster needs it |

Nothing in this second table is currently routed to. They are listed so that
"why not X?" has an answer with a number attached.

### Free models

All verified present in the 2026-08-12 catalog. `:free` slugs get retired
without notice — if free users start seeing errors, reload the live catalog on
the Models tab and re-assign.

| Slug | Context | Params | Notes |
|---|---:|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1000k | **550B total / 55B active** (MoE) | the one originally asked for, and the default Free model — biggest free model here, 1M context |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262k | 120B total / 12B active (MoE) | the fallback if Ultra is rate-limited |
| `nvidia/nemotron-3.5-lightning:free` | 1000k | — | 1M context |
| `nvidia/nemotron-3-nano-30b-a3b:free` | 256k | 30B total / 3B active (MoE) | |
| `google/gemma-4-31b-it:free` | 262k | 31B dense | third slot on Free; different vendor to Nemotron on purpose |
| `google/gemma-4-26b-a4b-it:free` | 262k | 26B total / 4B active (MoE) | |
| `openai/gpt-oss-20b:free` | 131k | 20B | smallest context of the free set |
| `poolside/laguna-s-2.1:free` | — | — | context not recorded in this fetch |
| `poolside/laguna-xs-2.1:free` | — | — | context not recorded in this fetch |
| `inclusionai/ling-3.0-tiny:free` | — | — | context not recorded in this fetch |
| `liquid/lfm-2.5-2.6b:free` | — | 2.6B | very small |
| `cohere/north-mini-code:free` | — | — | code-oriented |
| `nvidia/nemotron-nano-9b-v2:free` | — | 9B | |
| `nvidia/nemotron-nano-12b-v2-vl:free` | — | 12B | vision-language |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | — | 30B total / 3B active (MoE) | |
| `nvidia/nemotron-3.5-content-safety:free` | — | — | a moderation model, not a tutor |

A dash in Context means it was not recorded in this fetch, **not** that it is
small. Check the model page before assigning one of those to a tier.

---

## IMAGE

| Slug | ≈$/image | Latency / throughput | Notes |
|---|---:|---|---|
| `openai/gpt-image-1-mini` | 0.010 | poor latency data | $2.50/$2.50 per 1M, io $0.000008/tok |
| `x-ai/grok-imagine-image-2.0` | 0.010 | — | API `image` pricing field is also exactly $0.01 |
| `black-forest-labs/flux.2-klein-4b` | **0.014** | **156 ms, 1135 tok/s** | cheapest **and** fastest. io $0.0000034/tok |
| `krea/krea-2-medium-turbo` | 0.015 | — | |
| `qwen/qwen-image-3` | ~0.030 | 4 ms, 51 tok/s | **site says ~$0.03, the API `image` field says $0.003.** Both are recorded because they measure different things; assume the site figure until a real bill says otherwise |
| `black-forest-labs/flux.2-pro` | ~0.030 | — | io $0.0000073/tok |
| `recraft/recraft-v4.1-utility` | ~0.035 | — | |
| `recraft/recraft-v4.1` | ~0.035 | — | |
| `google/gemini-2.5-flash-image` | 0.039 | 630 ms, 179 tok/s | "Nano Banana". $0.30 in / $2.50 out per 1M, io $0.00003/tok; ~1290 output tokens x $0.00003 = $0.039 |
| `google/gemini-3.1-flash-lite-image` | 0.039 | — | $0.25 in / $1.50 out per 1M, io $0.00003/tok |
| `qwen/qwen-image-3-pro` | ~0.040 | — | |
| `recraft/recraft-v4` | ~0.040 | — | |
| `recraft/recraft-v3` | ~0.040 | — | |
| `bytedance-seed/seedream-4.5` | ~0.040 | — | it/io $0.0000096/tok |
| `black-forest-labs/flux.2-max` | ~0.070 | — | |
| `google/gemini-3.1-flash-image` | 0.077 | **12482 ms to first token** | "Nano Banana 2". $0.50 in / $3.00 out per 1M, io $0.00006/tok. Twice the price of NB1 and ~20x the latency |
| `google/gemini-3-pro-image` | 0.155 | — | $2 in / $12 out per 1M, io $0.00012/tok |
| `openai/gpt-image-2` | not published | — | $8/$8 per 1M tokens; no per-image figure |
| `openai/gpt-5.4-image-2` | not published | — | $8/$15 per 1M tokens; no per-image figure |
| `microsoft/mai-image-2.5-pro` | not published | — | $5/1M plus $0.000108 per input image |

### Methodology note — read before quoting any number above

Image models are priced two different ways and the table mixes both, because
OpenRouter itself does.

1. Some models carry a flat **`image` pricing field** — a real per-image price
   (`grok-imagine-image-2.0` = $0.01). Those numbers are exact.
2. Most are **token-priced**. For those, cost per image is
   **`output tokens × output rate`**, and output tokens are a function of
   **resolution**. A 512×512 render and a 2048×2048 render are billed at the
   same rate and cost wildly different amounts. The worked example is
   `gemini-2.5-flash-image`: ~1290 output tokens × $0.00003/tok = $0.039 — at
   *that* resolution. Double the pixels and the figure moves.
3. `qwen/qwen-image-3` shows the two methods disagreeing by 10x (site ~$0.03 vs
   API `image` field $0.003). That is not a typo in this file; the two fields
   are measuring different things and the discrepancy has not been resolved
   against a real invoice. Treat the higher number as the planning figure.

So: **every `≈$/image` figure is a planning estimate at a typical resolution,
not a quote.** MedMaster renders at `512x512` by default
(`DEFAULT_IMAGE_SIZE`), which is at the small end, so the real bill should come
in at or under these numbers. The per-day image caps (`imageLimits`) exist
precisely because this is the line item that can run away.

**The routing choice:** `flux.2-klein-4b` is the cheapest *and* the fastest by a
wide margin (156 ms vs 630 ms for Nano Banana, and 12.5 s for Nano Banana 2),
which almost never happens — so Pro and Instructor use it.
`gemini-2.5-flash-image` stays on Plus and stays in the Pro allow-list, because
its response shape is the one `js/images.js` is proven against and it is worth
having a known-good fallback one dropdown away. `gemini-3.1-flash-image` (NB2)
is twice the price and twenty times the latency of NB1 — it is in the verified
list, and it should stay out of the routing.

---

## VIDEO

**Caveat first, because it changes how you read the whole table:**

OpenRouter's API exposes **no per-request pricing for video at all** — no
per-second rate, no duration tier, no resolution breakdown. The only figure
available is the **"from $"** shown on each model's own page, which is the
**cheapest configuration**: typically the shortest duration at the lowest
resolution. A longer clip or a higher resolution costs more, sometimes by
several multiples, and *this table cannot tell you by how much*.

**Before routing anything to a video model, open its OpenRouter page and read
the actual duration/resolution pricing there.** The numbers below are only good
for ranking models against each other at their respective floors.

| Slug | From $ | |
|---|---:|---|
| `bytedance/seedance-2.0-mini` | 0.01345 | cheapest floor in the catalog |
| `bytedance/seedance-1.5-pro` | 0.02306 | |
| `alibaba/wan-2.6` | 0.04 | |
| `bytedance/seedance-2.0-fast` | 0.04035 | |
| `x-ai/grok-imagine-video` | 0.05 | |
| `google/veo-3.1-lite` | 0.05 | |
| `bytedance/seedance-2.0` | 0.06726 | |
| `x-ai/grok-imagine-video-1.5` | 0.08 | |
| `minimax/hailuo-2.3` | 0.0817 | |
| `alibaba/happyhorse-1.1` | 0.0988 | |
| `alibaba/happyhorse-1.0` | 0.0988 | |
| `alibaba/wan-2.7` | 0.10 | |
| `google/veo-3.1-fast` | 0.10 | |
| `bytedance/seedance-2.5` | 0.1028 | |
| `kwaivgi/kling-video-o1` | 0.112 | |
| `runway/gen-4.5` | 0.12 | |
| `kwaivgi/kling-v3.0-std` | 0.126 | |
| `minimax/hailuo-3` | 0.13 | |
| `kwaivgi/kling-v3.0-pro` | 0.168 | |
| `black-forest-labs/flux-3-video` | 0.17 | |
| `runway/aleph-2` | 0.28 | |
| `openai/sora-2-pro` | 0.30 | |
| `google/veo-3.1` | 0.40 | ~30x the cheapest floor |

**MedMaster routes nothing to video today.** There is no video feature in
`KNOWN_FEATURES`, and the cheapest floor here ($0.013) is already ~75 tutor
messages' worth of spend for one clip that may or may not be usable. This table
exists so that if a video feature is ever proposed, the conversation starts
from real numbers.

---

## How this maps onto the tiers

The applied routing (`RECOMMENDED_AI_CONFIG` in `js/ai.js`, mirrored as
`DEFAULT_AI_CONFIG` in both `js/ai.js` and `netlify/functions/ai.js`):

| Feature | Free | Plus | Pro / Instructor |
|---|---|---|---|
| tutor, patient, codeblue, sim, medadmin, community, questions | `nemotron-3-ultra-550b-a55b:free` | `deepseek-v4-flash-0731` | `deepseek-v4-flash-0731` |
| debrief, sbar | not in plan | `deepseek-v4-flash-0731` | `z-ai/glm-5.2` |
| image, mnemonic, avatar | not in plan | `gemini-2.5-flash-image` | `flux.2-klein-4b` |
| admin, other (untagged) | tier default | `deepseek-v4-flash-0731` | `deepseek-v4-flash-0731` |

Tier allow-lists:

- **Free:** `nemotron-3-ultra-550b-a55b:free`, `nemotron-3-super-120b-a12b:free`, `gemma-4-31b-it:free`
- **Plus:** `deepseek-v4-flash-0731`, `deepseek-v4-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-flash-image`
- **Pro:** everything in Plus, plus `z-ai/glm-5.2`, `gemini-3-flash-preview`, `flux.2-klein-4b`, `qwen/qwen-image-3`
- **Instructor:** `*` (every model)

A `featureModels` entry that names a model **outside** its tier's allow-list is
ignored by both the client and the server and silently falls back to
`models[0]`. It looks configured and behaves as though it is not — so every
route above names a model that is already in that tier's list. If you add a
route by hand, add the model to the tier as well.

Changing these defaults in code does **not** change an install that already has
a config in Firebase: `normalizeConfig()` honours explicitly stored tiers, so
an empty `tiers/plus/models` stays empty through any number of deploys. Use
**Admin Panel → AI → Settings → Apply recommended setup**, which previews the
diff and then writes the whole thing in one `set()` while preserving your daily
limits, image limits, spend ceiling and toggles.
