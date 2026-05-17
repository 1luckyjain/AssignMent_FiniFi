const Document = require('../models/Document');
const { parseDocument } = require('../services/geminiService');

/**
 * POST /documents/upload
 * Accepts a file upload, parses it with Gemini, and stores the result.
 */
const uploadDocument = async (req, res) => {
    try {
        const { documentType } = req.body;

        if (!['po', 'grn', 'invoice'].includes(documentType)) {
            return res.status(400).json({ error: 'Invalid documentType. Must be po, grn, or invoice.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const parsedData = await parseDocument(req.file.path, req.file.mimetype, documentType);

        if (!parsedData.poNumber) {
            return res.status(422).json({ error: 'Could not extract poNumber from document.' });
        }

        const document = new Document({
            documentType,
            poNumber: parsedData.poNumber.trim(),
            data: parsedData,
        });

        await document.save();

        return res.status(201).json({
            message: 'Document uploaded and parsed successfully.',
            documentId: document._id,
            poNumber: document.poNumber,
            parsedData,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * GET /documents/:id
 * Returns a stored parsed document by its MongoDB ID.
 */
const getDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found.' });
        }
        return res.json(document);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { uploadDocument, getDocument };
