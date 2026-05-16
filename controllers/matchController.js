const Document = require('../models/Document');

const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed) && parsed.getFullYear() > 2000) {
        return parsed;
    }
    // Try parsing DD/MM/YYYY or DD-MM-YYYY
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
        // Assume DD-MM-YYYY format mostly used in India
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        
        // Handle YYYY-MM-DD that got split
        if (year < 100 && day > 2000) {
            const temp = year;
            year = day;
            day = temp;
        }

        return new Date(year, month - 1, day);
    }
    return null;
};

const getMatchResult = async (req, res) => {
    try {
        const { poNumber } = req.params;
        
        const documents = await Document.find({ poNumber });
        
        const poDocs = documents.filter(d => d.documentType === 'po');
        const grnDocs = documents.filter(d => d.documentType === 'grn');
        const invoiceDocs = documents.filter(d => d.documentType === 'invoice');
        
        const responseData = {
            documentsLinked: {
                po: poDocs.length,
                grn: grnDocs.length,
                invoice: invoiceDocs.length
            },
            status: '',
            reasons: []
        };
        
        if (poDocs.length === 0) {
            responseData.status = 'insufficient_documents';
            responseData.reasons.push('PO is missing');
            return res.json(responseData);
        }
        
        if (poDocs.length > 1) {
            responseData.status = 'mismatch';
            responseData.reasons.push('duplicate_po');
            return res.json(responseData);
        }
        
        const po = poDocs[0].data;
        const poDate = normalizeDate(po.poDate);
        
        if (grnDocs.length === 0 && invoiceDocs.length === 0) {
            responseData.status = 'insufficient_documents';
            responseData.reasons.push('GRN and Invoice are missing');
            return res.json(responseData);
        }

        const reasons = new Set();
        let isPartiallyMatched = false;
        
        // Match Date
        for (const invDoc of invoiceDocs) {
            const inv = invDoc.data;
            const invDate = normalizeDate(inv.invoiceDate);
            if (poDate && invDate && invDate > poDate) {
                reasons.add('invoice_date_after_po_date');
            }
        }
        
        // Build Item maps
        const poItems = {};
        (po.items || []).forEach(item => {
            const key = (item.itemCode || item.sku || item.description || '').toString().toLowerCase().trim();
            if (key) {
                poItems[key] = (poItems[key] || 0) + (Number(item.quantity) || 0);
            }
        });
        
        const grnItems = {};
        grnDocs.forEach(doc => {
            (doc.data.items || []).forEach(item => {
                const key = (item.itemCode || item.sku || item.description || '').toString().toLowerCase().trim();
                if (key) {
                    grnItems[key] = (grnItems[key] || 0) + (Number(item.receivedQuantity || item.quantity) || 0);
                }
            });
        });
        
        const invoiceItems = {};
        invoiceDocs.forEach(doc => {
            (doc.data.items || []).forEach(item => {
                const key = (item.itemCode || item.sku || item.description || '').toString().toLowerCase().trim();
                if (key) {
                    invoiceItems[key] = (invoiceItems[key] || 0) + (Number(item.quantity) || 0);
                }
            });
        });
        
        // Item-level checks
        const allKeys = new Set([...Object.keys(poItems), ...Object.keys(grnItems), ...Object.keys(invoiceItems)]);
        
        let hasMismatch = false;
        
        for (const key of allKeys) {
            const poQty = poItems[key] || 0;
            const grnQty = grnItems[key] || 0;
            const invQty = invoiceItems[key] || 0;
            
            if (poQty === 0 && (grnQty > 0 || invQty > 0)) {
                reasons.add('item_missing_in_po');
                hasMismatch = true;
            }
            
            if (grnQty > poQty) {
                reasons.add('grn_qty_exceeds_po_qty');
                hasMismatch = true;
            }
            
            if (invQty > poQty) {
                reasons.add('invoice_qty_exceeds_po_qty');
                hasMismatch = true;
            }
            
            if (invQty > grnQty && grnDocs.length > 0) {
                reasons.add('invoice_qty_exceeds_grn_qty');
                hasMismatch = true;
            }
            
            // Partial match checks
            if (poQty > 0) {
                if (grnQty > 0 && invQty > 0) {
                    if (poQty !== invQty || poQty !== grnQty) {
                        isPartiallyMatched = true;
                    }
                } else if (grnQty === 0 || invQty === 0) {
                    // Documents are missing for full reconciliation
                    isPartiallyMatched = true;
                }
            }
        }
        
        if (reasons.size > 0) {
            responseData.status = 'mismatch';
            responseData.reasons = Array.from(reasons);
        } else if (grnDocs.length === 0 || invoiceDocs.length === 0) {
            responseData.status = 'insufficient_documents';
            if (grnDocs.length === 0) responseData.reasons.push('GRN is missing');
            if (invoiceDocs.length === 0) responseData.reasons.push('Invoice is missing');
        } else if (isPartiallyMatched) {
            responseData.status = 'partially_matched';
        } else {
            responseData.status = 'matched';
        }
        
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getMatchResult };
