interface Env {
  ASSETS: Fetcher;
  STATS_API_URL?: string;
  VITE_STATS_API_URL?: string;
  GROQ_API_KEY?: string;
  GROQ_API_URL?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'inline-speculation-rules' 'sha256-YovrZVYF56995nY6CSzWI89Wg8JftMKnbPvjulU8aMg=' https://apis.google.com https://www.gstatic.com https://www.google.com https://static.cloudflareinsights.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://firebasestorage.googleapis.com https://www.googletagmanager.com https://*.google.com https://*.google.com.ph",
  "connect-src 'self' https://*.cloudfunctions.net https://*.googleapis.com https://apis.google.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com https://cloudflareinsights.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://stats.g.doubleclick.net https://*.g.doubleclick.net https://www.google.com https://api.groq.com",
  "frame-src https://accounts.google.com https://*.firebaseapp.com blob: data:",
  "object-src blob: data:",
  "base-uri 'self'",
  "media-src 'self' https://ssl.gstatic.com",
].join("; ");

const SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Content-Security-Policy": CSP,
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Always override — Cloudflare may inject restrictive defaults.
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsOk(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Helpers

function getApiUpstream(env: Env, routePath: string): string | null {
  const configured = env.STATS_API_URL || env.VITE_STATS_API_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const suffix = routePath.replace("/api/v1", "");
    url.pathname = `${url.pathname.replace(/\/$/, "")}${suffix}`;
    return url.toString();
  } catch {
    return null;
  }
}

async function maybeGzipJson(
  response: Response,
  request: Request,
): Promise<Response> {
  const acceptsGzip =
    request.headers.get("Accept-Encoding")?.includes("gzip") ?? false;
  const type = response.headers.get("Content-Type") ?? "";
  if (!acceptsGzip || !type.startsWith("application/json")) return response;

  // Clone before reading — original stays tee'd for the <1KB / error fallback.
  // Reading `response.arrayBuffer()` directly would lock `response.body` and
  // `return response` would then throw "Body has already been used".
  const clone = response.clone();
  try {
    const body = await clone.arrayBuffer();
    // Skip small payloads — gzip overhead isn't worth it under ~1 KB.
    if (body.byteLength <= 1024) return response;

    const gzipped = new Blob([body])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const headers = new Headers(response.headers);
    headers.set("Content-Encoding", "gzip");
    headers.set("Vary", "Accept-Encoding");
    return new Response(gzipped, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    // Compression must never break the proxy — fall back to the
    // uncompressed response.
    return response;
  }
}

async function proxyApiRequest(
  request: Request,
  env: Env,
  routePath: string,
): Promise<Response> {
  if (request.method === "OPTIONS") return corsOk();
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);

  const upstreamUrl = getApiUpstream(env, routePath);
  if (!upstreamUrl)
    return json({ error: "Stats service not configured." }, 503);

  const forwardedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = request.headers.get("Authorization");
  if (authHeader) forwardedHeaders["Authorization"] = authHeader;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: forwardedHeaders,
      body: request.body,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" &&
            err !== null &&
            "message" in err &&
            typeof (err as Record<string, unknown>).message === "string"
          ? ((err as Record<string, unknown>).message as string)
          : "connection refused";
    return json({ error: `Backend unavailable: ${message}` }, 503);
  }

  // Preserve upstream content-type (e.g. text/html for errors) so the
  // client can detect non-JSON responses instead of blindly parsing HTML as JSON.
  const upstreamType = upstream.headers.get("Content-Type") || "";
  const contentType =
    upstreamType.startsWith("application/json") ||
    upstreamType.startsWith("text/")
      ? upstreamType
      : "application/json";

  const proxied = new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType,
      // Auth-scoped, mutable data — never cache API responses.
      "Cache-Control": "no-store",
    },
  });

  // Gzip large JSON responses (~5-10x smaller parse/clean transfers).
  return maybeGzipJson(proxied, request);
}

async function proxyExternalApi(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return corsOk();
  if (request.method !== "GET")
    return json({ error: "Method not allowed" }, 405);

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) return json({ error: "Missing url parameter" }, 400);

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json, text/csv, */*",
        "User-Agent": "Polymorpha-Ingestion/1.0",
      },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/octet-stream",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" &&
            err !== null &&
            "message" in err &&
            typeof (err as Record<string, unknown>).message === "string"
          ? ((err as Record<string, unknown>).message as string)
          : String(err);
    return json({ error: "Failed to fetch API: " + message }, 502);
  }
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_API_KEY_FALLBACK =
  "REDACTED_GROQ_KEY";

async function callGroq(
  messages: Array<{ role: string; content: string }>,
  env: Env,
): Promise<Response> {
  const key = env.GROQ_API_KEY || GROQ_API_KEY_FALLBACK;
  // Direct Groq call — matches: Groq().chat.completions.create(model="openai/gpt-oss-120b", messages, temperature=1, max_completion_tokens=2048, top_p=1, reasoning_effort="medium", stream=True)
  const groqRes = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 1,
      max_completion_tokens: 2048,
      top_p: 1,
      reasoning_effort: "medium",
      stream: true,
    }),
  });
  if (!groqRes.ok || !groqRes.body) {
    const txt = await groqRes.text().catch(() => "Unknown error");
    throw new Error(`Groq API error (${groqRes.status}): ${txt}`);
  }
  // Proxy Groq SSE directly to client (client expects data: {"choices":[{"delta":{"content":...}}]})
  return new Response(groqRes.body, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function streamSSE(answer: string): Response {
  const encoder = new TextEncoder();
  const tokens = answer.split(/(\s+)/);
  let idx = 0;
  const stream = new ReadableStream({
    async start(controller) {
      for (const tok of tokens) {
        if (!tok) continue;
        const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: tok } }] })}\n\n`;
        controller.enqueue(encoder.encode(chunk));
        if (idx++ % 8 === 0) await new Promise((r) => setTimeout(r, 8));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleStellaChat(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return corsOk();
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  let body: {
    messages?: Array<{ role: string; content: string }>;
    model?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  // Basic chatbot: prompt + rag like any AI, no hardcoded format — forward directly to Groq
  try {
    return await callGroq(messages, env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
}

// ── Recommend-a-Step: statistical persona (not ML consultant) ──
// Wording per review #15: direct optimisation target, not just "cares about"
const STATISTICAL_PERSONA = [
  "You are a statistical analyst helping a non-programming user determine the best statistical workflow for their stated objective. Prioritize statistical validity, interpretation, and actionable next steps over implementation details.",
  "The user cares about the statistical process and the validity of the analysis. They do not want programming instructions, software libraries, APIs, feature engineering pipelines, encoding instructions, or implementation details unless they explicitly ask for them.",
  "Recommend the best statistical workflow for the user's stated objective.",
  "Base your recommendations on the supplied data facts. Do not invent analyses that are unrelated to the objective.",
  "Prefer: descriptive statistics, distributions and visualisations, data-quality checks, assumptions, outlier assessment, appropriate statistical tests, effect sizes, confidence intervals, subgroup comparisons, interpretation and reporting.",
  "Do not automatically recommend machine-learning preprocessing.",
  "Do not recommend train/test splits unless the objective involves prediction.",
  "Do not recommend encoding categorical variables unless it is necessary for the specific statistical method being recommended.",
  "Do not recommend scaling unless it is required by the proposed statistical method.",
  "Do not recommend transformations merely because a variable is skewed. Explain whether the transformation is actually relevant to the user's objective.",
  'The recommendation should answer: "What is the best next statistical step for this objective and why?"',
].join("\n");

// ── State-aware: next-step analyst on top of existing tools (not generic advisor) ──
const STATE_AWARE_INSTRUCTION = [
  "IMPORTANT: You are operating inside an interactive statistical analysis application.",
  "The dataset has already passed through analysis and data-quality tools. The RAG contains facts and results produced by those tools — it IS the current analytical state, not just generic dataset metadata.",
  "Do NOT recommend repeating a check when the RAG already confirms that the check has been completed successfully. Do NOT ask the user to manually verify facts that the application already knows (e.g., if RAG says type=numeric, missing=0, duplicates=0, quality invalid=0 → do NOT say 'verify type is numeric' or 'treat missing values').",
  "Instead:",
  "1. Read the supplied RAG as the current state of the analysis.",
  "2. Identify what has already been established (ALREADY RESOLVED: e.g., numeric → yes, missing → 0, duplicates → 0).",
  "3. Identify the most important UNRESOLVED statistical issue (e.g., strong right skew mean 5.2 vs median 1, high upper tail, possible influential observations).",
  "4. Recommend the next useful action(s) in the workflow — the Next Best Statistical Action.",
  "5. Do not ask the user to manually verify facts that the application already knows.",
  "",
  "Concept: This feature is 'Next Best Statistical Action', optimized for:",
  "  OBJECTIVE + CURRENT ANALYTICAL STATE + CURRENT STAGE → NEXT BEST ACTION",
  "not: OBJECTIVE + DATASET → STATISTICAL ADVICE.",
].join("\n");

const EVIDENCE_HIERARCHY = [
  "The RAG is evidence produced by the application's analysis tools. Treat RAG facts as authoritative observations of the current dataset.",
  "Distinguish between:",
  "- VERIFIED: directly established by a tool (e.g., type=numeric, missing=0, duplicates=0, quality invalid=0)",
  "- OBSERVED: descriptive statistic produced by a tool (mean=5.2, median=1, skew=2.9, kurtosis=11, min/max, std, IQR)",
  "- UNRESOLVED: something the tools have not yet answered (is the mean appropriate? are high values influential? does tail affect objective?)",
  "- INFERRED: statistical interpretation you make from verified observations (e.g., 'mean appears influenced by upper tail')",
  "Never present an inference as if it were a verified fact. Do not say 'there are erroneous high-tenure values' when only skew is observed. Say 'mean 5.2 vs median 1 with skew 2.9 suggests small number of high-tenure observations may be influencing the average'.",
].join("\n");

const TOOL_AWARENESS = [
  "AVAILABLE ANALYTICAL STATE — The application may already have performed:",
  "- dataset profiling, column profiling, missing-value analysis, duplicate analysis, quality analysis, distribution / descriptive statistics.",
  "When a tool has already established a fact, do not recommend performing that same operation again. Instead, use its result to determine the next analytical capability to use. The recommendation engine does not replace these tools; it decides which existing analytical capability should logically be used next.",
  "Tool purpose:",
  "DATASET PROFILE → Understand dataset size, structure and variable types.",
  "COLUMN PROFILE → Understand distributions, central tendency, spread and column-level characteristics.",
  "MISSING ANALYSIS → Determine whether missingness requires attention.",
  "DUPLICATE ANALYSIS → Determine whether duplicate observations affect the analysis.",
  "QUALITY ANALYSIS → Identify invalid, inconsistent or suspicious data values.",
  "DISTRIBUTION / DESCRIPTIVE → Inspect shape, compare mean/median/SD/IQR, assess influence of tail.",
].join("\n");

const AVAILABLE_TOOLS_META = [
  "AVAILABLE METHODS AT THIS STAGE (authoritative — do not invent beyond this, do not hallucinate UI paths):",
  "The catalog below is the complete set of capabilities the application supports at this stage, with human-readable purpose and structural prerequisites (requires). Use it to reason, but do NOT present it as all recommended.",
  "",
  "Preview:",
  "- Dataset profile — Understand dataset size, structure and variable types — requires: dataset loaded — uiPath: Preview → Dataset header",
  "- Column profile — Understand distributions, central tendency, spread per column — requires: columns detected — uiPath: Preview → Column preview",
  "- Missing preview — Preview missing counts per column — requires: dataset loaded — uiPath: Preview → Column preview",
  "",
  "Process (Data quality / Transform / Feature engineering / Explore):",
  "- Row gate — Filter rows by threshold/condition — requires: dataset loaded — uiPath: Process → Pre-processing → Row gate",
  "- Sort rows — Order rows by column — requires: dataset loaded — uiPath: Process → Pre-processing → Sort rows",
  "- Row sampling — Sample head/tail/random — requires: dataset loaded — uiPath: Process → Pre-processing → Row sampling",
  "- Missing values — Strategies drop/mean/median/mode/constant — requires: missing >0 — uiPath: Process → Data quality → Missing values",
  "- Outliers — Methods iqr/zscore/percentile × actions remove/winsorize/flag — requires: numeric columns — uiPath: Process → Data quality → Outliers",
  "- Duplicates — Deduplicate by subset columns — requires: dataset loaded — uiPath: Process → Data quality → Duplicates",
  "- String replace, Standardize categories, Type conversion, Text cleanup, Columns & rename, Log/power transform — requires: relevant column types — uiPath: Process → Transform → …",
  "- Encoding (binary/label/onehot/ordinal), Bin/discretize, Date extraction, Derived columns, Lag/lead, Interaction — requires: relevant types — uiPath: Process → Feature engineering → …",
  "- Explore → Visualise / Descriptive / Frequencies — preview stats — uiPath: Process → Explore → …",
  "",
  "Analyse — Descriptive & Visual (always available, gated by column types):",
  "- Descriptive statistics — Center, spread, skewness, kurtosis, missingness — requires: numeric columns — uiPath: Analyse → Descriptive",
  "- Frequency — Category counts/percentages — requires: categorical columns — uiPath: Analyse → Frequency",
  "- Correlation matrix — Heatmap across numeric columns — requires: 2+ numeric — uiPath: Analyse → Correlation",
  "- Normality checks — Shapiro/Lilliefors to choose parametric vs rank — requires: numeric — uiPath: Analyse → Normality",
  "- Visual exploration — Bar/Box/Violin/Scatter etc. univariate/bivariate — requires: dataset loaded — uiPath: Analyse → Visualise",
  "",
  "Analyse — Inferential Tests (from @polymorpha/business-logic TEST_GROUPS, human-readable):",
  "Parametric (Difference):",
  "- Independent t-test — Compare means between two independent groups — requires: numeric outcome + categorical with 2 groups — uiPath: Analyse → Tests → Parametric → t-test",
  "- One-way ANOVA — Compare means across 3+ groups — requires: numeric + categorical 3+ groups — uiPath: Analyse → Tests → Parametric → ANOVA",
  "- Welch's ANOVA — Compare means when equal variance questionable — requires: numeric + categorical 3+ groups — uiPath: Analyse → Tests → Parametric → Welch's ANOVA",
  "- Levene's Test — Test equal variances (assumption) — requires: numeric + categorical — uiPath: Analyse → Tests → Parametric → Levene's Test",
  "- Two-way ANOVA — Two factors + interaction — requires: numeric + 2 categorical — uiPath: Analyse → Tests → Parametric → Two-way ANOVA",
  "- Repeated Measures ANOVA — Within-subject with Greenhouse-Geisser — requires: repeated numeric measures — uiPath: Analyse → Tests → Parametric → Repeated Measures ANOVA",
  "- TOST Equivalence — Two one-sided tests for equivalence — requires: numeric + bounds — uiPath: Analyse → Tests → Parametric → TOST Equivalence",
  "Non-Parametric (Difference / Association):",
  "- Mann-Whitney U — Rank-based 2 independent groups — requires: numeric + 2-group categorical — uiPath: Analyse → Tests → Non-Parametric → Mann-Whitney U",
  "- Kruskal-Wallis — Rank-based 3+ groups — requires: numeric + categorical 3+ groups — uiPath: Analyse → Tests → Non-Parametric → Kruskal-Wallis",
  "- Chi-square — Association two categorical — requires: 2 categorical — uiPath: Analyse → Tests → Non-Parametric → Chi-square",
  "- Fisher's Exact — Exact 2×2 small samples — requires: 2 categorical 2×2 — uiPath: Analyse → Tests → Non-Parametric → Fisher's Exact",
  "- Wilcoxon Signed-Rank — Paired non-parametric — requires: 2 related numeric (paired) — uiPath: Analyse → Tests → Non-Parametric → Wilcoxon Signed-Rank",
  "- Friedman — Non-parametric repeated ≥3 conditions — requires: repeated numeric — uiPath: Analyse → Tests → Non-Parametric → Friedman",
  "- Binomial Test — Proportion vs p₀ — requires: categorical/binary — uiPath: Analyse → Tests → Non-Parametric → Binomial Test",
  "- McNemar — Paired binary proportions — requires: paired binary — uiPath: Analyse → Tests → Non-Parametric → McNemar",
  "- GOF Chi-square — Single categorical vs expected — requires: single categorical — uiPath: Analyse → Tests → Non-Parametric → GOF Chi-square",
  "Relationship:",
  "- Pearson correlation — Linear association two numeric — requires: 2 numeric — uiPath: Analyse → Correlation → Pearson correlation",
  "- Kendall's Tau — Rank correlation robust to ties — requires: 2 variables — uiPath: Analyse → Correlation → Kendall's Tau",
  "- Partial Correlation — Correlation x–y controlling for z — requires: 3 numeric — uiPath: Analyse → Correlation → Partial Correlation",
  "- Point-biserial — Binary vs numeric correlation — requires: 1 numeric + 1 binary categorical — uiPath: Analyse → Correlation → Point-biserial",
  "Modelling (Regression):",
  "- OLS Regression — Model numeric target with predictors — requires: numeric target + predictors — uiPath: Analyse → Tests → Modelling → OLS Regression",
  "- VIF (Multicollinearity) — Detect collinear predictors — requires: 2+ numeric predictors — uiPath: Analyse → Tests → Modelling → VIF",
  "- Logistic Regression — Binary target with OR/CI/AUC — requires: binary categorical target + predictors — uiPath: Analyse → Tests → Modelling → Logistic Regression",
  "- Ridge Regression — L2-regularized with CV R² — requires: numeric target + predictors — uiPath: Analyse → Tests → Modelling → Ridge Regression",
  "- Lasso Regression — L1-regularized with feature selection — requires: numeric target + predictors — uiPath: Analyse → Tests → Modelling → Lasso Regression",
  "- Moderation — Interaction: target ~ predictor*mmoderator — requires: numeric target + predictor + moderator — uiPath: Analyse → Tests → Modelling → Moderation",
  "- Mediation (Sobel) — Indirect effect via mediator — requires: numeric target + predictor + mediator — uiPath: Analyse → Tests → Modelling → Mediation",
  "",
  "Analyse — Machine Learning (ML capabilities, only when objective explicitly involves prediction/classification/forecasting/model-building — see guardrails):",
  "- Classification — Predict categorical target (kNN, SVM, decision tree, random forest, logistic) — requires: categorical target + prediction intent — uiPath: Analyse → Machine learning → Classification",
  "- ML Regression — Predict numeric target (linear, tree, forest) — requires: numeric target + prediction intent — uiPath: Analyse → Machine learning → Regression",
  "",
  "Export:",
  "- Export PDF — Report with methodology/tables/charts — requires: analysis completed — uiPath: Export → PDF",
  "- Export Word — Editable report — requires: analysis completed — uiPath: Export → Word",
  "- Export Excel — Workbook with data/results — requires: analysis completed — uiPath: Export → Excel",
  "- Cart curation — Curate tests/visuals for export — requires: tests/visuals available — uiPath: Export → Cart",
  "",
  "When recommending, prefer 'Analyse → Descriptive statistics: examine YearsEmployed distribution and mean/median' or 'Analyse → Correlation → Pearson correlation: Age vs Debt' over abstract 'examine distribution'. The catalog is authoritative — do not invent capabilities or UI paths beyond those listed. The full catalog is informational; select exactly ONE primary next action whose requires is satisfied by RAG and whose purpose matches the objective.",
].join("\n");

const REASONING_GUARDRAILS = [
  "Objective vs method: For 'Calculate average YearsEmployed', objective is estimate/report mean, not 'analyze YearsEmployed'. Continuously ask: What must be true for this objective to produce a defensible answer?",
  "Do not expand scope unless objective requires it. Prefer smallest statistically sufficient workflow that answers objective. Do not recommend additional analyses merely because statistically interesting (no subgroup/hypothesis test/regression/correlation unless objective implies it). Terminate after What this will tell you; do not add Further analysis / Next steps / Future work / potential regression sections.",
  "Every recommended calculation must have a purpose. Explain what question calculation answers and how result affects next decision (statistic → interpretation → decision). Do not recommend statistics merely because standard. Prioritize effect size, CI, direction/magnitude and practical interpretation over p-value / statistical significance as primary purpose.",
  "Never fabricate: means, medians, sample sizes, p-values, CIs, effect sizes, percentages, distribution characteristics unless explicitly present in RAG. If unavailable, say it needs to be calculated by the application. Never invent numbers. Do not claim sample size is large enough / adequate / sufficient / stable without explicit power/precision calculation; state n factually only (e.g., n=690).",
  "Statistical-method selection is conditional: reason internally via variable types, number of groups, distribution/assumptions, study design → appropriate method (e.g., 2 groups → Welch t or Mann-Whitney, >2 groups → ANOVA/Welch ANOVA/Kruskal-Wallis, association → Pearson/Spearman/chi-square/Fisher) but do not dump decision tree; recommend appropriate next action.",
  "ML methods are available capabilities, but must not be recommended unless objective explicitly involves prediction/classification/forecasting/model-building intent. Do NOT treat 'regression' word alone as predictive — regression can be explanatory/inferential. Keep gating semantic, not keyword-heavy.",
  "Respect pipeline stage progression Preview → Process → Analyse → Export. Do not recommend analysis belonging to later stage unless necessary. Do not send backward unless evidence indicates unresolved issue requires it. Model should move user forward, not sideways.",
  "Do not mention internal architecture in output: never say 'catalog', 'available methods', 'RAG', 'VERIFIED/INFERRED', 'uiPath' — internal reasoning only; use plain statistical language.",
].join("\n");

const STAGE_DEFINITIONS: Record<string, string> = {
  preview:
    "PREVIEW — What should I look at in this dataset before proceeding? Focus on structure, variable types, missingness, and initial distributions relevant to the objective.",
  process:
    "PROCESS — What statistical/data preparation should I perform to make my dataset appropriate for my stated objective? Focus on cleaning, validation, transformations, and assumptions. Process does NOT mean machine-learning preprocessing or building a feature matrix. Do not invent a feature engineering pipeline.",
  analyse:
    "ANALYSE — What descriptive statistics, comparisons, statistical tests, models, or visualisations are appropriate for answering my objective?",
  export:
    "EXPORT — What should I report, and how should I describe the findings and methodology for this objective?",
};

const OUTPUT_CONTRACT = [
  "Return a concise next-step recommendation in plain Markdown. The React UI already renders the header 'Based on your data, you are recommended to do the following:' — do NOT repeat that header in your output.",
  "Structure (do not add extra sections beyond these, and do not emit the header line):",
  "### Recommended next step",
  "[ONE concrete action — reference exact uiPath from AVAILABLE METHODS, e.g., 'Analyse → Descriptive statistics: examine YearsEmployed distribution and mean/median' or 'Analyse → Correlation → Pearson correlation: Age vs Debt'. This is the primary recommendation — one immediate move. Use the exact uiPath strings; do not invent UI paths.]",
  "### Why",
  "[Statistical reason grounded in RAG — distinguish VERIFIED/OBSERVED vs INFERRED; explain why this step matters for objective. Prioritize effect size, CI, direction/magnitude and practical interpretation over p-value. Do not use statistical significance as primary purpose.]",
  "### What to look at",
  "[1–3 specific quantities to inspect — no fabricated values; e.g., highest YearsEmployed values, mean/median/SD/IQR, or for correlation: r, 95% CI, direction/magnitude, scatterplot/linearity check (p-value secondary).]",
  "### What this will tell you",
  "[Decision this enables — how result changes interpretation of objective; e.g., whether mean is representative or whether linear association is meaningful. Terminate cleanly; do not add Further analysis / Next steps / Future work.]",
  "Optionally after, only if it materially explains why something is NOT recommended:",
  "### Already established",
  "[e.g., 'YearsEmployed is numeric, missing 0, duplicates 0, quality clean → no cleaning needed' — do not include if not relevant]",
  "",
  "Constraints:",
  "- Do NOT exceed one primary Recommended next step (supporting looks go in What to look at).",
  "- Do NOT emit the header 'Based on your data, you are recommended to do the following:' — the UI already shows it.",
  "- Do not repeat completed checks; do not recommend actions RAG shows unnecessary.",
  "- Do not give generic statistical checklist or describe entire workflow.",
  "- Do not include 'Other methods available' section — that is rendered deterministically by the application from its authoritative catalog, not by you.",
  "- Do not provide code; do not mention Python/R/SQL/scikit-learn/APIs/pipelines/encoding/feature matrices.",
  "- Do not invent ML objective; do not say 'if you plan to model' unless objective involves modeling.",
  "- Do not mention internal architecture: never say 'catalog', 'available methods', 'RAG', 'VERIFIED/INFERRED', 'uiPath' in output — use plain statistical language.",
  "- If RAG partial, give general guidance without inventing values; keep to objective.",
].join("\n");

function buildRecommendSystemContent(stage: string): string {
  const def =
    STAGE_DEFINITIONS[stage] ??
    STAGE_DEFINITIONS.process ??
    STAGE_DEFINITIONS.preview;
  return `${STATISTICAL_PERSONA}\n\n${STATE_AWARE_INSTRUCTION}\n\n${EVIDENCE_HIERARCHY}\n\n${TOOL_AWARENESS}\n\n${AVAILABLE_TOOLS_META}\n\n${REASONING_GUARDRAILS}\n\nSTAGE DEFINITION:\n${def}\n\nOUTPUT CONTRACT:\n${OUTPUT_CONTRACT}`;
}

function stringifyRagSlice(value: unknown): string {
  // Per review #7: bound the object BEFORE serialization in recommendService.ts
  // (select bounded arrays/fields), not by slicing the resulting string.
  // Worker just stringifies the already-bounded object; no post-serialization truncation.
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function handleRecommend(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return corsOk();
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  let body: {
    stageLevel?: string;
    objective?: string;
    ragSlice?: unknown;
    prompt?: string;
    model?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const rawStage = String(body.stageLevel ?? "process").toLowerCase();
  // Normalize aliases: clean -> process, stats -> analyse
  const stage =
    rawStage === "clean"
      ? "process"
      : rawStage === "stats"
        ? "analyse"
        : rawStage;
  const objectiveRaw = String(body.objective ?? "").trim();
  const objective =
    objectiveRaw ||
    "(no objective set — give general statistical guidance for this stage without inventing an objective)";
  const ragSlice = body.ragSlice ?? {};
  const promptHint = String(body.prompt ?? "").trim();

  // Objective-first + state-aware: RAG is CURRENT ANALYTICAL STATE (what tools already discovered)
  // Already bounded by recommendService.ts buildRagSliceForStage (no post-serialization slice, review #7)
  const ragStr = stringifyRagSlice(ragSlice);
  const stageLabel = STAGE_DEFINITIONS[stage] ?? STAGE_DEFINITIONS.process;
  const userContent = [
    `OBJECTIVE (primary question — answer this, not generic dataset exploration): ${objective}`,
    `STAGE: ${stage.toUpperCase()} — ${stageLabel}`,
    promptHint ? `ADDITIONAL REQUEST: ${promptHint}` : "",
    `CURRENT ANALYTICAL STATE (RAG — facts/results produced by analysis & data-quality tools; represents what has already been discovered/established. Use to distinguish ALREADY RESOLVED vs UNRESOLVED):`,
    ragStr,
    `Task: Given OBJECTIVE + CURRENT ANALYTICAL STATE + CURRENT STAGE, what is the Next Best Statistical Action? Follow the output contract. Do not repeat RESOLVED checks (e.g., if RAG shows type=numeric missing=0 duplicates=0 → do not recommend verifying type or treating missing).`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages = [
    { role: "system", content: buildRecommendSystemContent(stage) },
    { role: "user", content: userContent },
  ];
  try {
    return await callGroq(messages, env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
}

// Router

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/stella/chat") return handleStellaChat(request, env);
    if (path === "/api/recommend") return handleRecommend(request, env);
    if (path === "/api/v1/stats")
      return proxyApiRequest(request, env, "/api/v1/stats");
    if (path === "/api/v1/machine-learning")
      return proxyApiRequest(request, env, "/api/v1/machine-learning");
    if (path === "/api/v1/parse")
      return proxyApiRequest(request, env, "/api/v1/parse");
    if (path === "/api/v1/clean")
      return proxyApiRequest(request, env, "/api/v1/clean");
    if (path === "/api/v1/execute")
      return proxyApiRequest(request, env, "/api/v1/execute");
    if (path === "/api/v1/proxy") return proxyExternalApi(request);

    // Tracking endpoint
    if (path === "/api/track") {
      if (request.method === "OPTIONS") return corsOk();
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Everything else: serve static assets with security headers
    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse);
  },
} satisfies ExportedHandler<Env>;
