# PaperBrain — Design Document
> Feed your existing brain. Don't become it.

---

## What This Is

PaperBrain is a capture and extraction tool that converts physical documents — mail, receipts, prescriptions, insurance EOBs, notes, anything on paper — into structured, searchable, exportable data.

It does **not** try to be your note-taking system, your filing system, or your brain. It feeds whatever system you already use.

**Core loop:**
```
Capture (photo/screenshot) → Extract (AI vision → JSON) → Search → Export
```

---

## The Problem

Paper has a ~3 day context window for most people. You touch it, you know what it is, and then life happens and it becomes "pile." Critical documents — HSA receipts, EOBs, bills, prescriptions — go invisible and stay invisible until a crisis forces you to touch every piece again.

Your phone camera roll is already being used as a second brain. It's full of photos of whiteboards, serial numbers, insurance cards, medication bottles, things you didn't want to forget. It's unsearchable, unstructured, and mixing sensitive data with cat photos.

Existing solutions ask you to abandon your current system and move into theirs. Nobody does that. This tool doesn't ask you to.

---

## Who This Is For

- Neurodivergent users with executive function challenges around paper management
- Anyone managing HSA reimbursements, medical paperwork, insurance EOBs
- People with paper piles that have lost their context
- Anyone using their camera roll as informal document storage
- People who use Notion, Obsidian, Airtable, Excel — and want their paper data to live there

---

## Core Features (MVP)

### 1. Capture
- **Mobile camera** — point at any document, capture instantly
- **Screenshot import** — drag in existing camera roll photos
- **Batch import** — process a pile at once

### 2. Extract
- AI vision model analyzes image
- Outputs structured JSON based on detected document type
- Stores original image alongside extracted data (source of truth is always the image)
- Confidence scoring on extracted fields — flags uncertain extractions for user review

### 3. Search
- Natural language search across all captured documents
- Example queries:
  - "HSA receipts from January"
  - "Prescription refills due this month"
  - "Have I paid my Xcel Energy bill?"
  - "What's my Walgreens copay for metformin?"
- Filter by document type, date range, status (paid/unpaid, submitted/pending)

### 4. Export
- Raw JSON download
- CSV export
- Webhook to external URL
- Pre-built connectors: Notion, Airtable, Google Sheets
- Zapier / Make compatible

---

## Document Types & Schemas

Each document type has a defined extraction schema. The AI identifies the type and extracts accordingly.

### Prescription Receipt
```json
{
  "type": "rx_receipt",
  "date": "2025-01-15",
  "pharmacy": "Walgreens",
  "drug_name": "Metformin HCL",
  "ndc_code": "00093-1048-01",
  "quantity": "90 tablets",
  "copay_amount": 12.00,
  "insurance_paid": 48.00,
  "prescriber": "Dr. Jane Smith",
  "rx_number": "7234891",
  "hsa_eligible": true,
  "reimbursement_status": "pending"
}
```

### Insurance EOB (Explanation of Benefits)
```json
{
  "type": "eob",
  "date": "2025-01-10",
  "insurer": "BlueCross BlueShield",
  "member_id": "XYZ123456",
  "provider": "City Medical Center",
  "service_date": "2024-12-20",
  "billed_amount": 450.00,
  "insurance_paid": 360.00,
  "patient_responsibility": 90.00,
  "deductible_applied": 0.00,
  "linked_rx_receipts": [],
  "hsa_reimbursable": true,
  "claim_number": "CLM-2025-001234"
}
```

### Utility Bill
```json
{
  "type": "utility_bill",
  "date_issued": "2025-01-05",
  "due_date": "2025-01-25",
  "provider": "Xcel Energy",
  "account_number": "XXXX-1234",
  "amount_due": 142.50,
  "status": "unpaid",
  "autopay": false,
  "period_start": "2024-12-01",
  "period_end": "2024-12-31"
}
```

### General Document (fallback)
```json
{
  "type": "general",
  "detected_category": "medical",
  "date": "2025-01-12",
  "issuer": "Mayo Clinic",
  "key_fields": {
    "patient_name": "Ryan Smith",
    "reference_number": "APT-20250112"
  },
  "summary": "Appointment reminder for follow-up consultation on January 28",
  "action_required": true,
  "action_description": "Call to confirm by January 20"
}
```

---

## HSA Reimbursement Workflow

This is a first-class feature, not an afterthought.

**The problem it solves:** You have an EOB from insurance, a receipt from the pharmacy, and a bill from the provider. You need to reconcile all three to know what's reimbursable and whether you've already submitted it. People lose hundreds of dollars a year from not tracking this.

**How PaperBrain handles it:**
1. Capture EOB → extracted and stored
2. Capture prescription receipt → system detects it may link to the EOB (same date range, same provider/drug)
3. System prompts: "This looks related to your EOB from [date]. Link them?"
4. Linked documents form a reimbursement cluster
5. Cluster shows: total reimbursable, submitted, pending, received
6. Export cluster as PDF summary for HSA submission record

**Status tracking:**
- `pending` — captured, not yet submitted
- `submitted` — marked as submitted, with optional submission date
- `reimbursed` — money received, with optional amount confirmation
- `not_eligible` — flagged as non-reimbursable

---

## Privacy & Security

This is non-negotiable. Users are putting driver's licenses, insurance cards, medical records, and financial documents into this system.

- **Encryption at rest** — all documents and extracted data encrypted
- **Local processing option** — for sensitive document types, offer on-device extraction (no server upload of image)
- **No training on user data** — extracted documents never used to train models
- **No data selling** — ever, full stop
- **Granular sharing controls** — users control exactly what exports where
- **Sensitive document tagging** — system flags PII-heavy documents (license, SSN, etc.) and handles them with extra care

---

## Tech Stack (Suggested)

### Frontend
- React Native (mobile first — camera is the primary capture method)
- Web companion app for desktop review and export management

### Backend
- Node.js / Express or Fastify
- PostgreSQL for structured document data
- Object storage (S3 or R2) for original images
- Redis for search indexing / queue

### AI Layer
- OpenAI GPT-4o Vision or Claude claude-sonnet-4-6 for extraction
- Prompt templates per document type for consistent schema output
- Fallback to general extraction when type is ambiguous

### Search
- Postgres full-text search for MVP
- Upgrade path to Typesense or Meilisearch if needed

### Export / Integrations
- Notion API
- Airtable API
- Google Sheets API
- Generic webhook
- Zapier / Make via webhook

---

## Data Flow

```
User captures image
        ↓
Image uploaded to secure storage
        ↓
Vision model analyzes image
        ↓
Document type detected
        ↓
Type-specific extraction prompt runs
        ↓
JSON schema populated
        ↓
Confidence scores calculated
        ↓
Low-confidence fields flagged for user review
        ↓
Document stored with image reference
        ↓
Available in search immediately
        ↓
User can export / push to integrations at any time
```

---

## MVP Scope (Weekend Build Target)

Get this working for yourself first before building for anyone else.

**Must have:**
- [ ] Mobile camera capture or screenshot import
- [ ] AI extraction to JSON (even if prompts are rough)
- [ ] Basic document list view with search
- [ ] Manual status tagging (paid/unpaid, submitted/pending)
- [ ] JSON export

**Explicitly out of scope for MVP:**
- Integration connectors (do this after the core works)
- HSA cluster linking (do this after basic capture works)
- Billing / accounts
- Onboarding flow

**Definition of done for MVP:**
The pile in the den gets captured. Three weeks later, you can still find everything in it and know its status. If that works, build more.

---

## Future Features (Post-MVP)

- **Reminder engine** — "Your Xcel bill is due in 3 days"
- **Recurring document detection** — "This looks like your monthly Comcast bill"
- **USPS Informed Delivery integration** — know what's coming before it arrives
- **Camera roll import** — bulk process existing photos that look like documents
- **Family/household sharing** — shared document spaces with permissions
- **Tax year organization** — filter and export everything from a tax year
- **Receipt email parsing** — forward confirmation emails, extract the same way

---

## Competitive Positioning

**We are not:** Notion, Evernote, Obsidian, or any notes app. We do not want to be your brain.

**We are not:** Expensify, Wave, or any accounting tool. We don't care about your business expenses.

**We are:** The intake layer. The thing that sits between the messy analog world and whatever digital system you already trust. We make paper disappear into data and get out of the way.

**Tagline options:**
- "Feed your brain. Don't become it."
- "Paper goes in. Data comes out."
- "Your pile, finally searchable."

---

## Open Questions

1. What's the right monetization model? (Freemium with export limits? Flat subscription? Per-document?)
2. Local vs. cloud processing for sensitive documents — user choice or automatic based on document type?
3. Mobile-first or web-first for MVP?
4. What's the minimum viable integration that proves the "feed your existing brain" positioning? (Probably Notion or Google Sheets)
5. What do you call the product?

---

*Document version: 0.1 — Fresh mayhem edition*
