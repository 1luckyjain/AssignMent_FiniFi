const Document = require('../models/Document');

/**
 * Parses a date string into a Date object.
 * Handles ISO (YYYY-MM-DD) and DD/MM/YYYY or DD-MM-YYYY formats.
 */
const parseDate = (dateStr) => {
    if (!dateStr) return null;

    // Try ISO / standard JS parse first
    const iso = new Date(dateStr);
    if (!isNaN(iso) && iso.getFullYear() > 1970) return iso;

    // Try DD/MM/YYYY or DD-MM-YYYY
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
        const [a, b, c] = parts.map(Number);
        // Detect if it's YYYY-MM-DD that failed above (shouldn't happen, but guard)
        if (a > 1000) return new Date(a, b - 1, c);
        // Assume DD-MM-YYYY (common in India)
        return new Date(c, b - 1, a);
    }

    return null;
};

/**
 * Resolves the item matching key for a given item.
 * Priority: itemCode → sku → description (normalized to lowercase).
 */
const itemKey = (item) =>
    (item.itemCode || item.sku || item.description || '').toString().toLowerCase().trim();

/**
 * Aggregates items from an array of documents into a quantity map: { key → qty }
 */
const aggregateItems = (docs, qtyField) => {
    const map = {};
    docs.forEach((doc) => {
        (doc.data.items || []).forEach((item) => {
            const key = itemKey(item);
            if (key) map[key] = (map[key] || 0) + (Number(item[qtyField]) || 0);
        });
    });
    return map;
};

/**
 * GET /match/:poNumber
 * Returns the three-way match result for all documents linked to a PO number.
 */
const getMatchResult = async (req, res) => {
    try {
        const poNumber = req.params.poNumber.trim();
        const documents = await Document.find({ poNumber });

        const poDocs     = documents.filter((d) => d.documentType === 'po');
        const grnDocs    = documents.filter((d) => d.documentType === 'grn');
        const invoiceDocs = documents.filter((d) => d.documentType === 'invoice');

        const response = {
            poNumber,
            documentsLinked: {
                po:      poDocs.map((d) => ({ id: d._id, poNumber: d.data.poNumber, poDate: d.data.poDate, vendorName: d.data.vendorName })),
                grn:     grnDocs.map((d) => ({ id: d._id, grnNumber: d.data.grnNumber, grnDate: d.data.grnDate })),
                invoice: invoiceDocs.map((d) => ({ id: d._id, invoiceNumber: d.data.invoiceNumber, invoiceDate: d.data.invoiceDate })),
            },
            documentCounts: { po: poDocs.length, grn: grnDocs.length, invoice: invoiceDocs.length },
            status: '',
            reasons: [],
        };

        // ── Insufficient documents checks ─────────────────────────────────────
        if (poDocs.length === 0) {
            response.status = 'insufficient_documents';
            response.reasons.push('PO not found for this PO number.');
            return res.json(response);
        }

        if (grnDocs.length === 0 && invoiceDocs.length === 0) {
            response.status = 'insufficient_documents';
            response.reasons.push('GRN and Invoice are missing.');
            return res.json(response);
        }

        // ── Duplicate PO check ────────────────────────────────────────────────
        if (poDocs.length > 1) {
            response.status = 'mismatch';
            response.reasons.push('duplicate_po');
            return res.json(response);
        }

        const po = poDocs[0].data;
        const poDate = parseDate(po.poDate);

        // ── Build item quantity maps ───────────────────────────────────────────
        const poItems      = aggregateItems(poDocs, 'quantity');
        const grnItems     = aggregateItems(grnDocs, 'receivedQuantity');
        const invoiceItems = aggregateItems(invoiceDocs, 'quantity');

        const reasons = new Set();
        let fullyReconciled = true;

        // ── Invoice date check ────────────────────────────────────────────────
        for (const inv of invoiceDocs) {
            const invDate = parseDate(inv.data.invoiceDate);
            if (poDate && invDate && invDate > poDate) {
                reasons.add('invoice_date_after_po_date');
            }
        }

        // ── Item-level quantity checks ─────────────────────────────────────────
        const allKeys = new Set([
            ...Object.keys(poItems),
            ...Object.keys(grnItems),
            ...Object.keys(invoiceItems),
        ]);

        for (const key of allKeys) {
            const poQty  = poItems[key]      || 0;
            const grnQty = grnItems[key]     || 0;
            const invQty = invoiceItems[key] || 0;

            // Item appears in GRN or Invoice but not in PO
            if (poQty === 0 && (grnQty > 0 || invQty > 0)) {
                reasons.add('item_missing_in_po');
            }

            if (grnQty > poQty)                          reasons.add('grn_qty_exceeds_po_qty');
            if (invQty > poQty)                          reasons.add('invoice_qty_exceeds_po_qty');
            if (grnDocs.length > 0 && invQty > grnQty)  reasons.add('invoice_qty_exceeds_grn_qty');

            // Check if quantities fully reconcile
            if (poQty > 0 && (grnQty !== poQty || invQty !== poQty)) {
                fullyReconciled = false;
            }
        }

        // ── Determine final status ─────────────────────────────────────────────
        if (reasons.size > 0) {
            response.status  = 'mismatch';
            response.reasons = Array.from(reasons);
        } else if (grnDocs.length === 0 || invoiceDocs.length === 0) {
            response.status = 'insufficient_documents';
            if (grnDocs.length === 0)     response.reasons.push('GRN is missing.');
            if (invoiceDocs.length === 0) response.reasons.push('Invoice is missing.');
        } else if (fullyReconciled) {
            response.status = 'matched';
        } else {
            response.status = 'partially_matched';
        }

        return res.json(response);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { getMatchResult };
