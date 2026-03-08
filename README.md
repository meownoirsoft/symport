# Symport

AI-powered document ingestion system that converts real-world paperwork into structured, searchable data.

Symport is a mobile-first web application that captures documents (camera or file upload), extracts structured information using AI vision models, and stores the results in a searchable database.

The system acts as an AI-powered document ingestion pipeline, transforming real-world paperwork into structured JSON that can be searched, tagged, and exported for automation workflows.

---

# Why This Exists

Managing physical paperwork is inefficient and error-prone.

Common examples include:

- medical EOBs
- prescription receipts
- insurance documents
- utility bills
- financial paperwork

Traditional document storage systems only store images or PDFs. They do not extract meaning from the documents.

Symport uses AI vision models to **interpret documents and convert them into structured data**, enabling search, tagging, and downstream automation.

---

# Architecture

Symport uses a document ingestion pipeline designed to convert real-world images into structured records.

Document Capture (camera or upload)  
↓  
Image processing  
↓  
AI Vision Extraction (GPT-4o)  
↓  
Structured JSON output  
↓  
PostgreSQL storage  
↓  
Search + tagging interface  
↓  
Exportable structured data


---

# Key Features

### Mobile Document Capture
Capture documents directly from a phone camera or upload files.

### AI Vision Extraction
Uses OpenAI GPT-4o Vision to extract structured JSON from document images.

Supported document categories include:

- prescription receipts
- insurance EOBs
- utility bills
- general documents

### Structured Data Storage
Extracted data is stored as structured JSON in PostgreSQL for flexible querying and retrieval.

### Full-Text Search
Documents can be searched using keywords or metadata.

### Status Tagging
Documents can be tagged with workflow states such as:

- pending
- submitted
- paid
- archived

### Data Export
Each document can be exported as JSON for integration with other systems.

---

# Example Extracted Data

Example output generated from a utility bill:

```json
{
  "document_type": "utility_bill",
  "provider": "City Water Department",
  "amount_due": 73.45,
  "due_date": "2025-02-15",
  "account_number": "****2391"
}
```

# Technology Stack

### Frontend
Next.js
### Backend
Node.js API routes
### Database
PostgreSQL + Prisma ORM
### AI
OpenAI GPT-4o Vision

### Infrastructure
Docker

---

# Development Setup

## Install Dependencies

```npm install```

## Database

Choose one option.

### Option 1 — Docker (recommended)

```npm run docker:up```

Postgres will start on port **5433**.

If port 5433 is already in use, edit `docker-compose.yml` and update the port and your `DATABASE_URL`.

### Option 2 — Existing Postgres

Create a database and user manually and set the connection string in `.env`.

---

## Environment Variables

cp .env.example .env

Set:

DATABASE_URL=  
OPENAI_API_KEY=

If `OPENAI_API_KEY` is not set, documents will be stored with placeholder extraction data.

---

## Run Migrations

```npm run db:migrate```

Alternatively:

```npm run db:push```

This will create tables without migration history.

---

## Start Development Server

```npm run dev```

Open:

http://localhost:3000

Use **Capture** to upload a document or take a photo.  
Use **View Documents** to search and inspect stored records.

---

# Scripts

```
npm run dev         # Start Next.js development server  
npm run build       # Build production bundle  
npm run start       # Start production server  
  
npm run db:generate # Generate Prisma client  
npm run db:migrate  # Run database migrations  
npm run db:push     # Push schema without migrations  
  
npm run docker:up   # Start Postgres in Docker
```

---

# Project Status

Active prototype.

The system is evolving as part of ongoing experimentation with AI-powered document understanding and structured data extraction.

---

# Design Notes

See the design document:

docs/paperless-brain-design-doc.md

This document describes the architecture and design decisions behind the system.

---

# Future Ideas

Potential improvements include:

- automatic document classification
    
- vector search across documents
    
- entity extraction improvements
    
- integration with personal knowledge systems
    
- automated workflow triggers
    

---
# License

MIT
