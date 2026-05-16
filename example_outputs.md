# Example Outputs

## Sample Parsed JSON from Gemini

### PO
```json
{
  "poNumber": "CI4PO05788",
  "poDate": "2026-03-17",
  "vendorName": "M/s AFP",
  "items": [
    {
      "itemCode": "11423",
      "description": "psm Cheesy Spicy Veg Momos 24.0 Pieces",
      "quantity": 50
    },
    {
      "itemCode": "11797",
      "description": "Meatigo Hot Wings 250.0 g",
      "quantity": 75
    }
  ]
}
```

### GRN
```json
{
  "grnNumber": "CI4000020234",
  "poNumber": "CI4PO05788",
  "grnDate": "2026-03-24",
  "items": [
    {
      "itemCode": "11423",
      "description": "psm Cheesy Spicy Veg Momos 24.0 Pieces",
      "receivedQuantity": 50
    },
    {
      "itemCode": "11797",
      "description": "Meatigo Hot Wings 250.0 g",
      "receivedQuantity": 75
    }
  ]
}
```

### Invoice
```json
{
  "invoiceNumber": "IN25MH2504251",
  "poNumber": "CI4PO05788",
  "invoiceDate": "2026-03-24",
  "items": [
    {
      "itemCode": "FG-P-F-0503",
      "description": "PSM Cheesy Spicy Vegetable Momos 24Pcs",
      "quantity": 50
    },
    {
      "itemCode": "FG-M-F-1703",
      "description": "Meatigo RTC Meatigo Hot Wings 250g",
      "quantity": 75
    }
  ]
}
```

## Sample Match Result

### Case 1: Fully Matched
```json
{
  "documentsLinked": {
    "po": 1,
    "grn": 1,
    "invoice": 1
  },
  "status": "matched",
  "reasons": []
}
```

### Case 2: Mismatch (Invoice Quantity Exceeds)
```json
{
  "documentsLinked": {
    "po": 1,
    "grn": 1,
    "invoice": 1
  },
  "status": "mismatch",
  "reasons": [
    "invoice_qty_exceeds_po_qty",
    "invoice_qty_exceeds_grn_qty"
  ]
}
```

### Case 3: Insufficient Documents
```json
{
  "documentsLinked": {
    "po": 1,
    "grn": 1,
    "invoice": 0
  },
  "status": "insufficient_documents",
  "reasons": [
    "Invoice is missing"
  ]
}
```
