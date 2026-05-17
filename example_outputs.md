# Example Outputs

## Sample Parsed JSON from Gemini

### PO (documentType: "po")
```json
{
  "poNumber": "CI4PO05788",
  "poDate": "2026-03-17",
  "vendorName": "M/s AFP",
  "items": [
    {
      "itemCode": "11423",
      "description": "PSM Cheesy Spicy Veg Momos 24 Pieces",
      "quantity": 50
    },
    {
      "itemCode": "11797",
      "description": "Meatigo Hot Wings 250g",
      "quantity": 75
    }
  ]
}
```

### GRN (documentType: "grn")
```json
{
  "grnNumber": "CI4000020234",
  "poNumber": "CI4PO05788",
  "grnDate": "2026-03-20",
  "items": [
    {
      "itemCode": "11423",
      "description": "PSM Cheesy Spicy Veg Momos 24 Pieces",
      "receivedQuantity": 50
    },
    {
      "itemCode": "11797",
      "description": "Meatigo Hot Wings 250g",
      "receivedQuantity": 75
    }
  ]
}
```

### Invoice (documentType: "invoice")
```json
{
  "invoiceNumber": "IN25MH2504251",
  "poNumber": "CI4PO05788",
  "invoiceDate": "2026-03-24",
  "items": [
    {
      "itemCode": "11423",
      "description": "PSM Cheesy Spicy Veg Momos 24 Pieces",
      "quantity": 50
    },
    {
      "itemCode": "11797",
      "description": "Meatigo Hot Wings 250g",
      "quantity": 75
    }
  ]
}
```

---

## Sample Match Results — GET /match/CI4PO05788

### Case 1: Fully Matched
All three documents present, quantities match, invoice date within range.
```json
{
  "poNumber": "CI4PO05788",
  "documentsLinked": {
    "po": [{ "id": "664a1b2c3d4e5f6a7b8c9d0e", "poNumber": "CI4PO05788", "poDate": "2026-03-17", "vendorName": "M/s AFP" }],
    "grn": [{ "id": "664a1b2c3d4e5f6a7b8c9d0f", "grnNumber": "CI4000020234", "grnDate": "2026-03-20" }],
    "invoice": [{ "id": "664a1b2c3d4e5f6a7b8c9d10", "invoiceNumber": "IN25MH2504251", "invoiceDate": "2026-03-24" }]
  },
  "documentCounts": { "po": 1, "grn": 1, "invoice": 1 },
  "status": "matched",
  "reasons": []
}
```

### Case 2: Mismatch (Invoice Quantity Exceeds PO)
Invoice billed for more units than PO ordered.
```json
{
  "poNumber": "CI4PO05788",
  "documentsLinked": {
    "po": [{ "id": "664a...", "poNumber": "CI4PO05788", "poDate": "2026-03-17", "vendorName": "M/s AFP" }],
    "grn": [{ "id": "664b...", "grnNumber": "CI4000020234", "grnDate": "2026-03-20" }],
    "invoice": [{ "id": "664c...", "invoiceNumber": "IN25MH2504251", "invoiceDate": "2026-03-24" }]
  },
  "documentCounts": { "po": 1, "grn": 1, "invoice": 1 },
  "status": "mismatch",
  "reasons": [
    "invoice_qty_exceeds_po_qty",
    "invoice_qty_exceeds_grn_qty"
  ]
}
```

### Case 3: Insufficient Documents (Only PO uploaded)
```json
{
  "poNumber": "CI4PO05788",
  "documentsLinked": {
    "po": [{ "id": "664a...", "poNumber": "CI4PO05788", "poDate": "2026-03-17", "vendorName": "M/s AFP" }],
    "grn": [],
    "invoice": []
  },
  "documentCounts": { "po": 1, "grn": 0, "invoice": 0 },
  "status": "insufficient_documents",
  "reasons": ["GRN and Invoice are missing"]
}
```

### Case 4: Partially Matched (GRN received less than PO ordered — no violation)
```json
{
  "poNumber": "CI4PO05788",
  "documentsLinked": {
    "po": [{ "id": "664a...", "poNumber": "CI4PO05788", "poDate": "2026-03-17", "vendorName": "M/s AFP" }],
    "grn": [{ "id": "664b...", "grnNumber": "CI4000020234", "grnDate": "2026-03-20" }],
    "invoice": [{ "id": "664c...", "invoiceNumber": "IN25MH2504251", "invoiceDate": "2026-03-24" }]
  },
  "documentCounts": { "po": 1, "grn": 1, "invoice": 1 },
  "status": "partially_matched",
  "reasons": []
}
```
