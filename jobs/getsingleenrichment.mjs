// getsingleenrichment.mjs
// On-demand single-tweet enrichment using OpenAI.
// Accepts tweetId, tweetText, and optional jobId as arguments.
//
// Usage:
//   node getsingleenrichment.mjs <tweetId> <tweetText> [jobId]
//
// Env:
//   MONGODB_URI=mongodb://127.0.0.1:27017
//   MONGODB_DB=global
//   OPENAI_API_KEY=sk-...
//   PRIMARY_MODEL=o4-mini
//   ESCALATION_MODEL=o3

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import OpenAI from 'openai';
import { XMLParser } from 'fast-xml-parser';

// ---------- config ----------
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB || 'global';
const ENRICH_COLL = process.env.ENRICH_COLL || 'breaking_news_enrichments';

const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'o4-mini';
const ESCALATION_MODEL = process.env.ESCALATION_MODEL || 'o3';

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- prompt ----------
const SYS_PROMPT = `
You are an OSINT / political / intelligence / media analyst.
Your task: extract structured intelligence from ONE tweet.

SCOPE
- Use ONLY what is in the tweet text itself. Do NOT assume facts, follow links, or add world knowledge beyond ordinary language understanding.
- If a field cannot be inferred, use null (for scalars) or [] (for lists). Be conservative.

OUTPUT
- Return STRICT JSON that matches the provided schema exactly.
- No extra keys, no comments, no trailing text.
- Keep writing short and neutral (analyst tone).

FIELD RULES:
- category: concise high-level label (e.g., conflict, disaster, politics, economy, crime, cyber, social, sports, other). Null if unclear.
- context: 1–2 neutral sentences summarizing the claim/event. Use "allegedly", "reportedly" if unconfirmed.
- locations[]: Only if clearly implied in the TEXT (place, country if stated or strongly implied). Do NOT invent coordinates; set lat/lon = null unless explicitly present. If only a country/sea/strait is mentioned, use that as place; country may be null when unclear.
- future_scenarios[]: 2–4 plausible developments tied to the tweet, each with likelihood 0..1 (calibrated).
- knock_on_effects[]: 2–4 second-order impacts (markets, shipping, escalation, protests, sanctions, etc.) with likelihood 0..1.
- entities.people/organizations/equipment: extract proper nouns & distinct references; deduplicate; prefer canonical forms if stated.
- event_type: specific taxonomy-friendly label if evident (e.g., "drone_attack","protest","sanctions","cyber_attack"); null if unclear.
- time_window: past_event | ongoing | next_24h | next_week | unclear.
- sentiment: toward the EVENT, -1..1. If impossible, 0.
- risk_score: 0..1 operational significance based on the text; be conservative.
- credibility: 0..1 from text cues only (hedging, sensationalism, evidence, specificity).
- sources_to_verify: URLs in text or 2–3 short search queries to verify.
- confidence: 0..1 overall confidence in extraction.
- needs_higher_model: true ONLY if sarcasm/irony likely, complex geopolitics/technical nuance, ambiguous actors/locations/date, non-English idioms, or media forensics required.
- newsworthiness: true if event seems significant enough for wider media coverage; false otherwise.

STYLE & GUARDRAILS
- Do NOT invent names, places, numbers, dates, or links.
- If an emoji/flag implies a country but text is ambiguous, you may set country with lower credibility/confidence.
- Arrays may be empty. Scalars may be null. Numbers are 0..1 (one or two decimals).
- Keep each scenario/effect to a single concise clause.

Return only the JSON object per schema.
`;

const SCHEMA_HINT = `
Output a JSON object with these top-level keys:
category, context, locations, future_scenarios, knock_on_effects,
entities, event_type, time_window, sentiment, risk_score, credibility,
sources_to_verify, confidence, needs_higher_model, notes.
If unknown: null (for scalars) or [] (for arrays). Do not include extra keys.`;

// ---------- utilities ----------
function createHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function stripCodeFences(s = '') {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

function extractFirstJsonSnip(text = '') {
  const OPENERS = ['{', '['];
  const CLOSERS = { '{': '}', '[': ']' };
  let start = -1, opener = '', depth = 0;
  let inStr = false, strQuote = '', escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === strQuote) { inStr = false; strQuote = ''; }
      continue;
    }

    if (ch === '"' || ch === "'") { inStr = true; strQuote = ch; continue; }

    if (start < 0 && OPENERS.includes(ch)) { start = i; opener = ch; depth = 1; continue; }
    if (start >= 0) {
      if (ch === opener) depth++;
      else if (ch === CLOSERS[opener]) depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return '';
}

function extractJsonFromResponse(resp) {
  const content = resp?.output?.[0]?.content ?? [];
  const jsonItem =
    content.find(c => c?.type === 'output_json' && c?.json) ||
    content.find(c => c?.json);
  if (jsonItem?.json && typeof jsonItem.json === 'object') return jsonItem.json;

  const textFromItems = content.map(c => c?.text).filter(Boolean).join('').trim();
  let text = textFromItems || resp?.output_text || '';
  text = stripCodeFences(text);

  const candidate = extractFirstJsonSnip(text);
  if (!candidate) {
    const err = new Error('No JSON found in response text');
    err.rawText = text.slice(0, 400);
    throw err;
  }
  return JSON.parse(candidate);
}

// ---------- JSON Schema ----------
const enrichmentSchema = {
  name: 'tweet_enrichment',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      category: { type: ['string', 'null'] },
      context: { type: ['string', 'null'] },
      locations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            place: { type: 'string' },
            country: { type: ['string', 'null'] },
            lat: { type: ['number', 'null'] },
            lon: { type: ['number', 'null'] }
          },
          required: ['place', 'country', 'lat', 'lon']
        }
      },
      future_scenarios: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            scenario: { type: 'string' },
            likelihood: { type: 'number' }
          },
          required: ['scenario', 'likelihood']
        }
      },
      knock_on_effects: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            effect: { type: 'string' },
            likelihood: { type: 'number' }
          },
          required: ['effect', 'likelihood']
        }
      },
      entities: {
        type: 'object',
        additionalProperties: false,
        properties: {
          people: { type: 'array', items: { type: 'string' } },
          organizations: { type: 'array', items: { type: 'string' } },
          equipment: { type: 'array', items: { type: 'string' } }
        },
        required: ['people', 'organizations', 'equipment']
      },
      event_type: { type: ['string', 'null'] },
      time_window: {
        type: ['string', 'null'],
        enum: ['past_event', 'ongoing', 'next_24h', 'next_week', 'unclear', null]
      },
      sentiment: { type: ['number', 'null'] },
      risk_score: { type: ['number', 'null'] },
      credibility: { type: ['number', 'null'] },
      sources_to_verify: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' },
      needs_higher_model: { type: 'boolean' },
      notes: { type: ['string', 'null'] }
    },
    required: [
      'category', 'context', 'locations', 'future_scenarios', 'knock_on_effects',
      'entities', 'event_type', 'time_window', 'sentiment', 'risk_score', 'credibility',
      'sources_to_verify', 'confidence', 'needs_higher_model', 'notes'
    ]
  }
};

// ---------- model call ----------
async function callModel({ text, model }) {
  const tries = [
    { model, variant: 'schema-strict' },
    { model, variant: 'schema-loose' },
    { model: ESCALATION_MODEL, variant: 'schema-strict' },
    { model: ESCALATION_MODEL, variant: 'json-only' }
  ];

  let lastErr;
  for (const t of tries) {
    try {
      const out = await callModelOnce({ text, model: t.model, variant: t.variant });
      return { result: out, modelUsed: t.model };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Model failed on all attempts');
}

async function callModelOnce({ text, model, variant }) {
  const isReasoning = /^o3($|-)|^o4-mini($|-)/.test(model);

  const userBase = `TWEET TEXT:
${text || ''}`;

  const textFormat =
    variant === 'json-only'
      ? { type: 'json_object' }
      : {
          type: 'json_schema',
          name: enrichmentSchema.name,
          strict: variant === 'schema-loose' ? false : enrichmentSchema.strict,
          schema: enrichmentSchema.schema
        };

  const user =
    variant === 'json-only'
      ? `${userBase}\n\nReturn ONLY a valid JSON object. ${SCHEMA_HINT}`
      : userBase;

  const resp = await openai.responses.create({
    model,
    ...(isReasoning ? { reasoning: { effort: 'medium' } } : {}),
    input: [
      { role: 'system', content: SYS_PROMPT },
      { role: 'user', content: user }
    ],
    ...(isReasoning ? {} : { temperature: 0.2 }),
    max_output_tokens: 1200,
    text: { format: textFormat }
  });

  return extractJsonFromResponse(resp);
}

// ---------- RSS helpers ----------
function buildSearchTermsFromEnrichment(enrichment = {}) {
  const terms = new Set();
  const entities = enrichment.entities || {};
  const locations = enrichment.locations || [];

  const addTokens = (str) => {
    if (!str) return;
    str
      .split(/[,\s]+/)
      .map(t => t.replace(/[^a-z0-9\-]+/gi, '').trim())
      .filter(t => t.length > 1)
      .forEach(t => terms.add(t));
  };

  (entities.people || []).forEach(addTokens);
  (entities.organizations || []).forEach(addTokens);
  (entities.equipment || []).forEach(addTokens);
  (locations || []).forEach((loc) => {
    addTokens(loc.place);
    addTokens(loc.country);
  });

  return Array.from(terms).slice(0, 8);
}

const GOOGLE_NEWS_RSS_BASE =
  process.env.GOOGLE_NEWS_RSS_BASE || 'https://news.google.com/rss/search?q=';

async function fetchAdditionalLinksFromRss(enrichment) {
  const terms = buildSearchTermsFromEnrichment(enrichment);
  if (!terms.length) return [];

  const query = encodeURIComponent(terms.join(','));
  const url = `${GOOGLE_NEWS_RSS_BASE}${query}&hl=en-US&gl=US&ceid=US:en`;

  let res = null;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error('RSS fetch failed:', err.message || err);
    return [];
  }

  if (!res.ok) {
    console.error('RSS HTTP error:', res.status, res.statusText);
    return [];
  }

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  let parsed = null;

  try {
    parsed = parser.parse(xml);
  } catch (err) {
    console.error('RSS XML parse error:', err.message || err);
    return [];
  }

  const items = parsed?.rss?.channel?.item;
  if (!items) return [];

  const arr = Array.isArray(items) ? items : [items];

  return arr
    .slice(0, 10)
    .map((item) => {
      const text = item.title || item.description || null;
      const link = item.link || null;
      return text && link ? { text, link } : null;
    })
    .filter(Boolean);
}

// ---------- main ----------
async function main() {
  const tweetId = process.argv[2]?.trim();
  const tweetText = process.argv[3]?.trim();
  const jobId = process.argv[4]?.trim() || null;

  if (!tweetId || !tweetText) {
    console.error('Usage: node getsingleenrichment.mjs <tweetId> <tweetText> [jobId]');
    process.exit(1);
  }

  const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  try {
    await mongo.connect();
    const db = mongo.db(DB_NAME);
    const enrichColl = db.collection(ENRICH_COLL);

    // Check if enrichment already exists
    const existing = await enrichColl.findOne({ tweetId });
    if (existing) {
      console.log(`Enrichment already exists for tweetId=${tweetId}, skipping.`);
      process.exit(0);
    }

    console.log(`Enriching tweetId=${tweetId}...`);

    let result;
    let modelUsed = PRIMARY_MODEL;
    let additionalLinks = [];

    try {
      const callResult = await callModel({ text: tweetText, model: PRIMARY_MODEL });
      result = callResult.result;
      modelUsed = callResult.modelUsed;

      // Escalate on ambiguous/low-confidence
      if (result?.needs_higher_model && (result?.confidence ?? 0) < 0.6) {
        const escalated = await callModel({ text: tweetText, model: ESCALATION_MODEL });
        result = escalated.result;
        modelUsed = escalated.modelUsed;
      }
    } catch (e) {
      console.error('Model call failed:', e.message);
      result = {
        error: e.message || 'Unknown parse error',
        needs_higher_model: true,
        confidence: 0
      };
    }

    // Try to fetch related links from Google News RSS
    try {
      additionalLinks = await fetchAdditionalLinksFromRss(result);
    } catch (e) {
      console.error('Failed to fetch additional links:', e.message);
      additionalLinks = [];
    }

    const now = new Date();

    const enrichDoc = {
      tweetId,
      ...result,
      additional_links: additionalLinks,
      model_used: modelUsed,
      hash: createHash(JSON.stringify({ text: tweetText, modelUsed })),
      source: 'on_demand_search',
      jobId,
      updatedAt: now
    };

    await enrichColl.updateOne(
      { tweetId },
      { $set: enrichDoc },
      { upsert: true }
    );

    console.log(`Enriched tweetId=${tweetId} using model=${modelUsed}`);
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
