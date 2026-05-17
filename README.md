# Three-Way Match Engine for PO, GRN, and Invoice

A Node.js + Express backend that accepts Purchase Order (PO), Goods Receipt Note (GRN), and Invoice uploads, extracts structured data via the **Gemini API**, stores it in **MongoDB**, and performs a rule-based three-way match at the item level.

---

## Tech Stack
- **Runtime:** Node.js + Express
- **Database:** MongoDB (Mongoose)
- **AI Parsing:** Google Gemini API (`gemini-2.0-flash-lite`)
- **File Uploads:** Multer

---

## Approach

### Parsing Flow
1. User uploads a file (`multipart/form-data`) with a `documentType` field (`po`, `grn`, `invoice`).
2. The file is saved temporarily via Multer.
3. The file bytes are base64-encoded and sent to Gemini with a strict extraction prompt.
4. Gemini returns structured JSON (poNumber, dates, items[], etc.).
5. The parsed JSON is saved to MongoDB under the `Document` collection, indexed by `poNumber`.

### Out-of-Order Upload Handling
Matching is computed **on-demand** at query time (`GET /match/:poNumber`), not at upload time.

This means:
- Documents are stored independently as they arrive.
- When `GET /match/:poNumber` is called, the engine fetches all documents for that PO number and evaluates the rules against whatever is currently available.
- **No state machine or event queue is needed.** Any upload order works automatically.

---

## Data Model

A single `Document` collection stores all three types:

```
{
  documentType : "po" | "grn" | "invoice"   // indexed enum
  poNumber     : String                      // indexed for fast lookup
  data         : Mixed                       // raw Gemini-extracted JSON
  createdAt    : Date
}
```

Using a single collection with a flexible `Mixed` data field avoids rigid schema migrations as field extraction evolves, while the `poNumber` index makes cross-document lookups fast.

---

## Item Matching Key

**Choice:** `itemCode` → `sku` → `description` (first non-empty value, lowercased and trimmed).

**Reason:** Real-world documents often use inconsistent codes across PO, GRN, and Invoice (e.g., vendor codes vs buyer codes). The fallback chain ensures matching still works even if only a description is present. All values are normalized to lowercase to prevent case-mismatch failures.

---

## Matching Logic

All validations are performed **per item key** across aggregated quantities:

| Rule | Reason Code |
|---|---|
| GRN quantity > PO quantity | `grn_qty_exceeds_po_qty` |
| Invoice quantity > PO quantity | `invoice_qty_exceeds_po_qty` |
| Invoice quantity > total GRN quantity | `invoice_qty_exceeds_grn_qty` |
| Invoice date > PO date | `invoice_date_after_po_date` |
| GRN/Invoice item not in PO | `item_missing_in_po` |
| More than 1 PO for a poNumber | `duplicate_po` |

### Match Status
- `matched` — All documents present, all quantities match, no violations.
- `partially_matched` — No violations, but quantities don't fully reconcile (e.g. partial delivery).
- `insufficient_documents` — Missing PO, GRN, or Invoice.
- `mismatch` — One or more rules violated.

---

## API Reference

### 1. Upload a document (via Gemini parsing)
```
POST /documents/upload
Content-Type: multipart/form-data

Fields:
  file          (File)   — the PO/GRN/Invoice file
  documentType  (Text)   — "po", "grn", or "invoice"
```

### 2. Get a parsed document
```
GET /documents/:id
```

### 3. Get three-way match result
```
GET /match/:poNumber
```

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file
cp .env.example .env
# Fill in MONGODB_URI and GEMINI_API_KEY

# 3. Start the server
node server.js
```

---

## Assumptions
- Gemini successfully extracts `poNumber` from all documents. If it fails, the upload is rejected with a 400 error.
- There is exactly **1 PO** per `poNumber`. Multiple POs trigger a `duplicate_po` mismatch.
- Multiple GRNs and Invoices are valid and their quantities are **summed** per item before comparison.

## Tradeoffs
- **Dynamic match on read** is simple and handles out-of-order uploads perfectly, but would need caching (e.g. Redis) at scale.
- **Flexible `Mixed` schema** avoids migrations but loses MongoDB-level field validation on nested items.
- **Item key fallback chain** improves resilience but can produce false matches if two unrelated items share a description.
