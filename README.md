# Three-Way Match Engine for PO, GRN, and Invoice

A Node.js backend service that extracts structured data from uploaded Purchase Order (PO), Goods Receipt Note (GRN), and Invoice documents using the Gemini API, stores the data in MongoDB, and performs three-way matching based on defined business rules.

## Approach & Architecture
- **Tech Stack:** Node.js, Express, MongoDB (Mongoose), Google Gemini API (1.5-flash).
- **File Uploads:** Handled via `multer`.
- **Data Extraction:** Uploaded images/files are sent to the Gemini API with a strict prompt to extract structural fields into JSON.
- **Out-of-Order Uploads:** Handled seamlessly because parsed documents are stored individually with their extracted `poNumber`. The match logic queries MongoDB for all available documents under a given `poNumber` at the time of the request.
- **Matching Execution:** The match status is evaluated dynamically on-the-fly (`GET /match/:poNumber`) instead of maintaining a complex state machine on every upload. This easily resolves out-of-order document arrivals.

## Data Model
There is a single `Document` collection in MongoDB that stores all three document types.
- `documentType`: Enum (`po`, `grn`, `invoice`)
- `poNumber`: Indexed for fast querying.
- `data`: A dynamic `Mixed` schema storing the JSON extracted by Gemini.
- `createdAt`: Timestamp.

## Matching Logic
Matching happens at the item level. 
**Item Matching Key:** I chose to use `itemCode` or `sku` (falling back to `description` if missing), converted to lowercase and trimmed. This provides resilience against slightly inconsistent naming or missing fields in real-world extracted documents.

Validations performed:
1. `grn_qty_exceeds_po_qty`: GRN quantity > PO quantity.
2. `invoice_qty_exceeds_po_qty`: Invoice quantity > PO quantity.
3. `invoice_qty_exceeds_grn_qty`: Invoice quantity > GRN quantity (if GRN exists).
4. `invoice_date_after_po_date`: Invoice date > PO date.
5. `item_missing_in_po`: GRN or Invoice contains items not present in the PO.
6. `duplicate_po`: Multiple POs found for the same `poNumber`.

**Match Outputs:**
- `matched`: All documents present, quantities fully match, no violations.
- `partially_matched`: Documents present but waiting on more items/quantities, no violations yet.
- `insufficient_documents`: Missing PO, or missing both GRN and Invoice, etc.
- `mismatch`: One or more validation rules violated.

## Assumptions & Tradeoffs
- **Assumption:** The Gemini API correctly extracts the `poNumber` from all documents. If a document lacks a readable PO number, it will be rejected during upload.
- **Tradeoff:** Using a single model with a flexible `data` field avoids strict schema migrations if the extracted fields evolve, but sacrifices strict MongoDB-level validation on the nested items.
- **Tradeoff:** Calculating the match status dynamically on read is very scalable for out-of-order uploads, but might require optimization (e.g., caching or materialized views) if the system scales to millions of items per PO.

## What I would improve with more time
1. Add structured validation (e.g., Joi/Zod) before saving the Gemini output to MongoDB.
2. Implement robust retry mechanisms or fallback OCR methods if Gemini fails to parse complex layouts.
3. Cache match results and use MongoDB Change Streams to invalidate the cache only when new documents are added for a `poNumber`.
4. Implement a comprehensive test suite (Jest/Supertest).
