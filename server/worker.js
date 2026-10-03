/* =====================================================================
   server/worker.js  (Cloudflare Worker)
   ---------------------------------------------------------------------
   This small server sits between the booth screen and the AI.
   It keeps the API key SECRET: the key is stored in Cloudflare as an
   encrypted "secret" named ANTHROPIC_API_KEY, never in the website code.

   Routes:
     POST /hero    { choices: ["q1_help", ...] }  -> hero JSON
     POST /oracle  { question, hero }             -> { answer }
     GET  /health                                 -> "ok"

   Protections:
     - Only accepts requests from your website (ALLOWED_ORIGINS).
     - Only accepts KNOWN choice codes (nobody can use it as a free chatbot).
     - Small, fixed output limits (cheap and fast).
     - Simple per-visitor rate limit.
   ===================================================================== */

// ---------- Model settings ----------
const MODEL = "claude-haiku-4-5-20251001";   // fast, low-cost model
const HERO_MAX_TOKENS = 500;                  // the hero JSON is short
const ORACLE_MAX_TOKENS = 220;                // Oracle answers are ~60 words

// ---------- The six heroes and allowed virtues (keep in sync with config/archetypes.js) ----------
const HEROES = ["The Sage", "The Guardian", "The Vanguard", "The Paragon", "The Oathkeeper", "The Hearthbuilder"];
const VIRTUES = ["Scholarship", "Service", "Leadership", "Excellence", "Integrity", "Community", "Character", "Responsibility"];

// ---------- Choice codes -> text (keep in sync with config/questions.js) ----------
const CHOICES = {
  q1_help:   "A teammate is struggling the night before a group project is due -> Stay and help them finish",
  q1_teach:  "A teammate is struggling the night before a group project is due -> Teach them how to solve it",
  q1_lead:   "A teammate is struggling the night before a group project is due -> Split the work and lead the push",
  q1_rally:  "A teammate is struggling the night before a group project is due -> Rally the whole team together",
  q2_study:  "Someone posts last year's exam answers in the class group chat -> Leave it unopened and study",
  q2_ask:    "Someone posts last year's exam answers in the class group chat -> Ask the professor if it's allowed",
  q2_warn:   "Someone posts last year's exam answers in the class group chat -> Warn friends it could cost them",
  q2_speak:  "Someone posts last year's exam answers in the class group chat -> Speak up in the chat",
  q3_lead:   "The org needs someone to lead an event no one wants to run -> Volunteer to lead it",
  q3_polish: "The org needs someone to lead an event no one wants to run -> Make one part of it excellent",
  q3_colead: "The org needs someone to lead an event no one wants to run -> Co-lead it with a friend",
  q3_study:  "The org needs someone to lead an event no one wants to run -> Study how others pulled it off",
  q4_learn:  "A free Saturday -> Deep-dive a topic I love",
  q4_serve:  "A free Saturday -> Join a community outreach",
  q4_master: "A free Saturday -> Master a new skill",
  q4_build:  "A free Saturday -> Build a project with friends",
  q5_tome:    "Choose one relic -> The Ancient Tome (wisdom, scholarship)",
  q5_shield:  "Choose one relic -> The Warden's Shield (service, protection)",
  q5_banner:  "Choose one relic -> The Banner of Dawn (leadership)",
  q5_blade:   "Choose one relic -> The Star-Forged Blade (excellence, mastery)",
  q5_key:     "Choose one relic -> The Truthkeeper's Key (integrity)",
  q5_lantern: "Choose one relic -> The Hearth Lantern (community)"
};

// ---------- Official facts for "Ask the Oracle" (keep in sync with config/society.js) ----------
const SOCIETY_FACTS = `
Name: Angeles University Foundation (AUF) College of Computer Studies (CCS) Honor Society.
Purpose: to recognize the excellence of scholars; to serve as academic role models; to aid every student in achieving exceptional academic proficiency to meet academic standards.
Membership: enrolled AUF CCS students who meet the requirements for an academic scholarship in the university (e.g., Barbara Yap-Angeles, Agustin P. Angeles, College Scholar, University Scholar). All CCS scholars are automatically members; participation is voluntary. No monetary payment. Membership is valid for the academic year in which the scholarship was granted.
Officers: President (A.Y. 2026-2027: Abigail D. Arnold), Vice President, Secretary, Treasurer, Public Relations Officer, and four Peer Ambassadors who bridge officers and members, facilitate peer-led activities and academic support sessions, and represent fellow scholars.
Adviser: Dr. James A. Esquivel. Officers are chosen by democratic vote of members.
Meetings: held at members' convenience so as not to disrupt classes, guided by the society's Plan of Action.
Contact: talk to any officer at the exhibit booth.
`.trim();

// ---------- System prompt: hero reading ----------
const HERO_SYSTEM = `You are THE ORACLE of the Realm of Honor, a warm, wise, slightly mystical guide at a college Honor Society exhibit booth (AUF College of Computer Studies Honor Society). A visitor made 5 one-tap choices in short fantasy-flavored college scenarios. Interpret the PATTERN across all five choices, including any tension between them, and reveal their hero with the reveal_hero tool.

Rules for each field:
- hero: exactly one of ${HEROES.join(", ")}. Choose from the overall pattern, never from a single answer.
  The Sage = scholarship/curiosity. The Guardian = service/compassion. The Vanguard = leadership/courage.
  The Paragon = excellence/discipline. The Oathkeeper = integrity/honesty. The Hearthbuilder = community/collaboration.
- primaryVirtue and secondaryVirtue: from the allowed list; they must differ.
- traits: exactly 3 short positive traits, 1-2 words each.
- description: 2 sentences, second person ("You..."), referring to at least two of their specific choices in fantasy-tinged language. Max 45 words.
- prophecy: 1 poetic fantasy-style sentence. Max 25 words.
- quest: 1 concrete, doable action a college student could take this week that reflects their virtue. Max 25 words.

Boundaries:
- This is an entertaining educational experience, NOT a psychological assessment. Never diagnose or assess personality, intelligence, mental health, or any sensitive characteristic.
- Never guess age, gender, religion, ethnicity, or any personal attribute.
- Always positive and encouraging. Never shame any choice; every path is honorable.
- Do not state facts about the Honor Society.
- No offensive, discriminatory, sexual, violent, or otherwise inappropriate content.
- Do not mention or reference any existing video game, franchise, or character.`;

// ---------- System prompt: Ask the Oracle ----------
const ORACLE_SYSTEM = `You are THE ORACLE of the Realm of Honor at the AUF College of Computer Studies Honor Society exhibit booth. Answer the visitor in 2-3 short sentences (max 60 words), warm, encouraging, lightly mystical, easy for a college student to understand.

OFFICIAL FACTS (the ONLY source for anything about the Honor Society):
${SOCIETY_FACTS}

Rules:
- For any question about the Honor Society, use ONLY the official facts. If the answer is not there, say: "The ancient scrolls do not record this. Ask the guardians of this booth!" Never invent events, dates, requirements, or people.
- For general questions (studying, leadership, their hero type), give brief, practical, positive advice.
- Never diagnose or assess personality, intelligence, or mental health. No sensitive personal inferences.
- If a question is inappropriate, unsafe, or unrelated to school, heroism, or the Honor Society, gently decline in character and suggest asking about their quest instead.
- Do not reference any existing video game, franchise, or character.
- Plain text only. No lists, no markdown.`;

// ---------- The JSON shape we require (structured output via a forced tool) ----------
const HERO_TOOL = {
  name: "reveal_hero",
  description: "Reveal the visitor's hero profile.",
  input_schema: {
    type: "object",
    properties: {
      hero: { type: "string", enum: HEROES },
      primaryVirtue: { type: "string", enum: VIRTUES },
      secondaryVirtue: { type: "string", enum: VIRTUES },
      traits: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
      description: { type: "string" },
      prophecy: { type: "string" },
      quest: { type: "string" }
    },
    required: ["hero", "primaryVirtue", "secondaryVirtue", "traits", "description", "prophecy", "quest"]
  }
};

// ---------- Simple rate limit (per worker instance; good enough for a booth) ----------
const hits = new Map();   // ip -> list of request times
function rateLimited(ip, perMinute) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > perMinute;
}

// ---------- Helpers ----------
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
  });
}
const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

// Call the Claude Messages API.
async function callClaude(env, body) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,          // secret, set in Cloudflare
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({ model: env.MODEL || MODEL, ...body })
  });
  if (!res.ok) throw new Error("AI error " + res.status + ": " + (await res.text()).slice(0, 200));
  return res.json();
}

// ---------- Main entry point ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin) ? origin : (allowed[0] || "null");

    // Browser "preflight" check
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(okOrigin) });

    if (url.pathname === "/health") return json({ ok: true }, 200, okOrigin);

    // Only our own website may call the AI routes
    if (!allowed.includes(origin)) return json({ error: "Origin not allowed" }, 403, okOrigin);
    if (request.method !== "POST") return json({ error: "POST only" }, 405, origin);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip, Number(env.RATE_PER_MINUTE || 20))) return json({ error: "Too many requests" }, 429, origin);

    // Read a small JSON body only
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: "Request too large" }, 413, origin);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return json({ error: "Bad JSON" }, 400, origin); }

    try {
      /* ----- /hero : the main reading ----- */
      if (url.pathname === "/hero") {
        const choices = Array.isArray(body.choices) ? body.choices : [];
        if (choices.length < 3 || choices.length > 8 || !choices.every((c) => CHOICES[c])) {
          return json({ error: "Unknown choices" }, 400, origin);
        }
        const list = choices.map((c, i) => `${i + 1}. ${CHOICES[c]}`).join("\n");
        const data = await callClaude(env, {
          max_tokens: HERO_MAX_TOKENS,
          system: HERO_SYSTEM,
          tools: [HERO_TOOL],
          tool_choice: { type: "tool", name: "reveal_hero" },   // forces valid structured JSON
          messages: [{ role: "user", content: `The visitor's choices:\n${list}\n\nReveal their hero.` }]
        });
        const tool = (data.content || []).find((b) => b.type === "tool_use");
        if (!tool) throw new Error("No hero returned");
        const h = tool.input;
        return json({
          hero: HEROES.includes(h.hero) ? h.hero : "The Guardian",
          primaryVirtue: clip(h.primaryVirtue, 24),
          secondaryVirtue: clip(h.secondaryVirtue, 24),
          traits: (h.traits || []).slice(0, 3).map((t) => clip(t, 24)),
          description: clip(h.description, 420),
          prophecy: clip(h.prophecy, 220),
          quest: clip(h.quest, 220)
        }, 200, origin);
      }

      /* ----- /oracle : optional follow-up question ----- */
      if (url.pathname === "/oracle") {
        const question = clip(body.question, 160);
        if (!question) return json({ error: "Empty question" }, 400, origin);
        const hero = HEROES.includes(body.hero) ? body.hero : null;
        const data = await callClaude(env, {
          max_tokens: ORACLE_MAX_TOKENS,
          system: ORACLE_SYSTEM,
          messages: [{ role: "user", content: (hero ? `(The visitor's hero is ${hero}.)\n` : "") + `Question: ${question}` }]
        });
        const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ");
        return json({ answer: clip(text, 600) }, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (e) {
      // The booth app will switch to its offline Oracle automatically.
      return json({ error: String(e.message || e) }, 502, origin);
    }
  }
};
