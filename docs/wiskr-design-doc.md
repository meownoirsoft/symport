# Wiskr 2.0 — Design Document
> Your context. Any AI. No lock-in.

---

## What This Is

Wiskr is a multi-model AI conversation interface built on top of Symport. It takes the document intelligence and context that Symport provides and makes it the foundation of every AI conversation you have. You never start from scratch. You never explain yourself again. The AI already knows your situation before you type a word.

Wiskr is not a chatbot. It's a personal intelligence layer that sits between your life's data and any AI model you want to reason about it with.

**Core loop:**
```
Select context (Symport contexts + notes) → Chat with any AI → Capture what's useful back into context → Context compounds over time
```

---

## Foundation

Wiskr is built inside the Symport codebase. It is not a separate app. Symport provides:

- Document capture and extraction
- Context system (vehicle, medical, house, legal, etc.)
- Semantic search via pgvector
- Context dependent export
- Postgres backend

Wiskr adds the conversation and intelligence layer on top of this foundation.

---

## Architecture

### Tech Stack
- Same NextJS + Node + Postgres as Symport
- OpenRouter for all model API calls — one API, every model, no vendor lock-in
- pgvector for semantic search across both documents and conversation history

### Database Schema (Wiskr additions)

```sql
-- Model personas
personas (
  id, 
  name,                    -- "Spark", "Deep", "Draft", etc.
  display_name,            -- Human readable
  model_string,            -- OpenRouter model identifier
  provider,                -- Google, Anthropic, OpenAI, etc.
  description,             -- Task affinity description
  cost_tier,               -- cheap / mid / expensive
  avatar_url,
  created_at
)

-- Conversations
conversations (
  id,
  title,
  parent_conversation_id,  -- null if main, points to parent if branch
  created_at,
  updated_at
)

-- Junction: which contexts are active in which conversation
conversation_contexts (
  conversation_id,
  context_id
)

-- Messages
messages (
  id,
  conversation_id,
  role,                    -- user / assistant
  content,
  persona_id,              -- which model/persona responded
  created_at,
  embedding vector(1536)   -- for semantic search across conversation history
)

-- Captured responses (Wiskr'd back into context)
captured_responses (
  id,
  message_id,              -- source message
  content,                 -- selected text or full response
  added_to_context_id,     -- which context it was added to
  created_at
)

-- Branch cards (follow up later queue)
branch_cards (
  id,
  source_conversation_id,
  source_message_id,
  trigger_text,            -- the selected text that created this card
  conversation_id,         -- null until promoted/opened as conversation
  status,                  -- pending / active / dismissed
  created_at
)

-- Generated next questions
next_questions (
  id,
  conversation_id,
  content,
  used,
  created_at
)
```

---

## Mobile UI Flow

Wiskr is mobile-first. The desktop three column concept is a secondary consideration. The primary design target is a single column mobile experience where everything is gesture or tap accessible but out of the way by default.

### Main View — Chat
Full screen conversation. Nothing competing with it.

- **Top bar** — slim strip showing active context chips (e.g. "Medical · Vehicle"). Tap any chip to remove it. Tap + to add more contexts. Keeps the AI's awareness visible without taking space.
- **Bottom input bar** — thumb-accessible row with voice input, text field, send button, and quick capture button. Everything needed to have a conversation without scrolling or reaching.
- The conversation thread fills the rest of the screen. Clean. Readable. Never interrupted.

### Capture — Bottom Sheet
Tap the capture button in the bottom input bar.

- A sheet slides up from the bottom
- Options: Camera, Photo Library, File Import
- Take or select the document
- Sheet dismisses immediately — back in conversation in under 5 seconds
- Processing happens async in the background
- Subtle indicator shows extraction is running
- Notification or badge when capture is complete and reviewable
- Zero friction — capture never pulls you out of a conversation for long

### Branch Stack — Right Drawer
Swipe in from the right edge or tap a subtle indicator when branch cards are waiting.

- Drawer slides over chat at ~80% screen width
- Shows accumulated branch cards and next questions
- Tap any card to expand into a side conversation within the drawer
- Side conversation uses its own persona — different model than main if desired
- Swipe right to dismiss drawer — back to main chat instantly, nothing lost
- Branch cards persist until dismissed or promoted to main

### Context Management — Left Drawer
Swipe in from the left edge or tap the context chips in the top bar.

- Full screen context picker slides in
- Shows all available contexts with document counts
- Toggle contexts on/off for the current conversation
- Tap any context to see what documents are inside it
- Tap done — returns to chat with updated context loaded
- The AI immediately has access to newly added contexts

### Wiskr Capture — Long Press
Long press any AI response bubble to trigger capture options.

- Wiskr full response → adds entire message to selected context
- Wiskr selection → highlight specific text first, then long press
- Choose which context receives it
- Confirmation toast — subtle, non-intrusive
- Context is enriched immediately for future conversations

### Bottom Navigation — 4 Tabs
Persistent tab bar at the very bottom of the screen.

| Tab | Purpose |
|-----|---------|
| **Chat** | Main conversation view |
| **Symport** | Capture and review documents |
| **Contexts** | Manage and browse all contexts |
| **Settings** | Personas, OpenRouter key, preferences |

Everything reachable in one tap from anywhere in the app.

### Mobile Layout Principles
- Chat is always the home screen
- Nothing requires more than one tap or swipe to reach
- Capture is fast enough to do mid-conversation without losing your place
- Drawers dismiss with a single swipe — no modal traps
- Branch cards are ambient — visible when you want them, invisible when you don't
- Context chips tell you what the AI knows at a glance without explaining it

### Desktop (Secondary)
On wider screens the drawers become persistent side panels forming a natural three column layout — left contexts, center chat, right branch stack. No separate desktop design needed. The mobile layout scales up gracefully.

---

## Branch System

Branches are user-initiated, not AI-initiated. You decide what becomes a branch.

### Creating a Branch

**Method 1 — Text selection**
Highlight any text in your own message or an AI response. A small popover appears with three options:
- **Follow up later** → creates a branch card in the right drawer
- **Ask now** → sends as immediate follow up in main thread
- **Wiskr this** → captures into active context

**Method 2 — Thread action bar**
At the bottom of the main conversation thread, a persistent action bar offers the same three options applied to the most recent exchange.

### Branch Cards
Each card in the right panel shows:
- The source text fragment that triggered it
- Which message it came from (linkable)
- Timestamp
- Status: pending / active / dismissed
- Actions: Open as side conversation, Promote to main, Dismiss

### Opening a Branch
When you open a branch card it becomes a side conversation in the right panel. The main conversation compresses slightly but stays visible and active. You can:
- Have the side conversation fully without losing main thread context
- Switch attention between main and side freely
- Close the side conversation and return to full main view without clicking anything special
- Promote the side conversation to main if it becomes the more important thread

### Branch Discovery
- Conversation list shows main conversations
- Branch conversations are folded under their parent in the list
- Branch conversations are also independently searchable and findable
- You never lose a branch even if you forget which conversation spawned it

---

## Multi-Model Conversations

The right panel side conversation can use a different model than the main conversation. This enables:

**Parallel model comparison**
Same context package, two different models, responses visible simultaneously. See where they agree, where they diverge, which one understood your situation better.

**Task-appropriate model routing**
Main conversation using a powerful expensive model for deep reasoning. Side conversation using a cheap fast model for quick fact checks or tangents.

**Model trust building**
When multiple models land in the same place you have more confidence. When they diverge you know to dig deeper.

No other tool offers this. You are never forced to switch contexts to compare models.

---

## Persona System

Models are exposed as named personas with personality and task affinity. Users pick personas not model strings.

### Persona Definitions

| Persona | Tier | Provider | Model | Task Affinity |
|---------|------|----------|-------|---------------|
| **Quest** | Free | Alibaba | qwen/qwen-2.5-72b-instruct | Exploration and research. Good at finding angles you haven't considered. Best for open ended questions and brainstorming. |
| **Tina** | Free | Meta | meta-llama/llama-3.1-70b-instruct | Reliable generalist. Solid for everyday tasks, summaries, and drafting. The dependable workhorse. |
| **Spark** | Free | Google | google/gemini-2.5-flash | Lightning fast, low cost. Best for quick questions, tangents, and side conversations where speed matters more than depth. |
| **Prism** | Free | OpenAI | openai/gpt-4o-mini-2024-07-18 | Versatile and balanced. Good across many task types. Best when you're not sure which persona to use. |
| **Sage** | Free | DeepSeek | deepseek/deepseek-v3.2 | Deep knowledge and careful reasoning. Surprisingly capable for a free tier. Good for technical and analytical questions. |
| **Titan** | Pro | Meta | meta-llama/llama-3.1-405b-instruct | Heavy lifting. Best for complex multi-step reasoning, long documents, and tasks that need sustained attention. |
| **Ember** | Pro | Anthropic | anthropic/claude-3-haiku | Warm and conversational. Best for brainstorming, creative thinking, and conversations that need a human touch. |
| **Gem** | Pro | Google | google/gemini-3.1-pro | Research and synthesis. Good at pulling together information from your context and making sense of it. |
| **Gale** | Pro | Mistral | mistralai/mistral-large | Precise and efficient. Best for structured tasks, formatting, and outputs that need to be clean and exact. |
| **Verse** | Studio | Anthropic | anthropic/claude-3.5-sonnet | Writing and editing. Best for anything language-heavy - drafts, rewrites, tone matching, creative work. |
| **Nova** | Studio | Anthropic | anthropic/claude-sonnet-4-6 | Writing and language at frontier level. Best for demanding creative and editorial work where Verse needs a step up. |
| **Aurora** | Studio | OpenAI | openai/gpt-4o-2024-11-20 | Broad capability powerhouse. Best for complex tasks that touch multiple domains at once. |
| **Vega** | Studio | OpenAI | openai/gpt-5.2 | Frontier reasoning. Best for the hardest problems, nuanced analysis, and anything where quality is the only metric. |
| **Dash** | Studio | OpenAI | openai/gpt-4-turbo | Fast and capable. Best for Studio-quality output when you need it quickly without waiting for the heaviest models. |
| **Opal** | Studio | Anthropic | anthropic/claude-opus-4 | Deep creative and analytical work. Best for long form thinking, complex creative projects, and tasks that need genuine wisdom. |

**Note:** Verify all model strings against current OpenRouter model list before implementing. OpenRouter uses provider-prefixed format. GPT-5 availability should be confirmed before including in production.

### Persona Selection
- Dropdown in the conversation input bar
- Each conversation remembers which persona was used for each message
- Side conversations can use different personas than main
- Personas map to OpenRouter model strings under the hood
- Swapping the underlying model doesn't change the persona name or user experience

---

## Wiskr Capture

Every AI response has a Wiskr capture action. This is the bidirectional flow that makes context compound over time.

### Capture Options
- **Wiskr full response** — entire AI message added to active context
- **Wiskr selection** — highlight specific text, capture just that
- **Wiskr to specific context** — choose which context receives it

### What Gets Captured
- AI analysis of your documents
- Interpretations of your medical situation
- Suggestions about your house, vehicles, finances
- Research the AI did on your behalf
- Any insight you want available in future conversations

### Effect
Captured content becomes part of the context. Next conversation that includes that context already has the AI's previous analysis available. Every conversation makes future conversations smarter.

---

## Context Assembly

When you start a conversation or add contexts to an existing one, Symport assembles a context package invisibly.

### Assembly Process
1. User selects contexts (vehicle, medical, house, etc.)
2. Symport pulls relevant documents from each context
3. Extracts key fields from JSON for each document
4. Includes any previously Wiskr'd responses in those contexts
5. Assembles into a structured context block
6. Injects into conversation system prompt silently

### Context Package Format
```
[CONTEXT: Medical]
Prescriptions: Metformin 500mg (RX: 7234891, CVS, Dr. Smith), ...
Recent EOBs: BlueCross - $340 patient responsibility - January 2026
Lab results: October 2024 - [key values]
Previous AI analysis: [any Wiskr'd responses]

[CONTEXT: Vehicle - 2019 Honda CR-V]
Registration: Expires April 2026
Insurance: State Farm - renews March 2026
Last service: Brake pads October 2024
...
```

### Context Principles
- Small and targeted — only what's relevant to selected contexts
- No unnecessary tokens — precise context produces better answers
- Model agnostic — same context works with any AI via OpenRouter
- No vendor lock-in — context lives in Symport not in any AI's memory

---

## Summon Pack & Card UI

Shelved for later. Not in scope for initial build. Both are creative-mode features that add complexity without serving the core document and context use case. Will revisit when the foundation is solid.

---

## Chat List & Navigation

```
Conversations
├── Medical deep dive (Jan 15)
│   ├── Branch: drug interaction question
│   └── Branch: insurance appeal research
├── House refinance thinking (Jan 10)
│   └── Branch: comparable rates
└── BEDNOMANCER chapter 3 (Jan 8)
    ├── Branch: Cheddar backstory
    └── Branch: Straylight Station lore
```

- Main conversations listed chronologically
- Branches folded under parent with disclosure triangle
- Branches also independently searchable
- Semantic search across all conversation history via pgvector
- Filter by context, persona, date range

---

## Deployment Path

**Now:** Local Docker, single user, no auth. Move fast, build for yourself first.

**Later:** 
- Add auth (Clerk or NextAuth — drops into NextJS cleanly)
- Deploy Docker to VPS, Railway, or Render
- Environment variables swap, domain added, done
- Multi-user with personal data isolation

No architectural changes required for this transition. Build it right locally and the cloud deployment is mostly configuration.

---

## What Makes This Different

| Feature | ChatGPT | Claude | Wiskr |
|---------|---------|--------|-------|
| Multi-model in one view | ✗ | ✗ | ✓ |
| Side conversations without losing main | ✗ | ✗ | ✓ |
| Context from physical documents | ✗ | ✗ | ✓ |
| Bidirectional context capture | ✗ | ✗ | ✓ |
| Vendor lock-in | ✓ | ✓ | ✗ |
| Branches discoverable independently | ✗ | ✗ | ✓ |
| Personal data stays yours | ✗ | ✗ | ✓ |

---

## Build Sequence

1. **pgvector** — add to Symport first, embed documents and messages
2. **Auth** — when ready for cloud/multi-user
3. **Personas table + OpenRouter integration** — model routing layer
4. **Conversations + messages schema** — basic chat working
5. **Context assembly** — context selector → context package → system prompt
6. **Mobile UI** — bottom nav, chat view, top bar context chips, bottom input bar
7. **Branch cards** — long press popover, right drawer accumulation
8. **Side conversations** — open branch in right drawer without losing main
9. **Wiskr capture** — bidirectional context flow via long press
10. **Next questions + related ideas** — right drawer intelligence

---

## Positioning

**Not:** Another AI chat interface
**Not:** A note-taking app
**Not:** A document manager

**Is:** The layer that makes every AI conversation you have actually informed by your real life.

Your documents live in Symport. Your thinking lives in your notes. Your conversations happen in Wiskr. The AI sees all of it. Nothing gets lost. Context compounds. You never start from scratch again.

**Tagline:** Your context. Any AI. No lock-in.

---

*Document version: 0.1 — Built in one night*
*Companion document: symport-design-doc.md*