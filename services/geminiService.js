const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls Gemini generateContent with exponential backoff on 429 rate-limit errors.
 */
const generateWithRetry = async (model, content, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await model.generateContent(content);
        } catch (err) {
            const status = err?.status || (err?.message?.includes('429') ? 429 : null);
            if (status === 429 && attempt < maxRetries) {
                const waitMs = attempt * 15000;
                console.warn(`Rate limit hit. Retrying in ${waitMs / 1000}s (attempt ${attempt}/${maxRetries})...`);
                await sleep(waitMs);
            } else {
                throw err;
            }
        }
    }
};

/**
 * Builds the extraction prompt for the given document type.
 */
const buildPrompt = (documentType) => `
You are an expert data extractor for financial documents.

Extract structured data from this ${documentType.toUpperCase()} document and return ONLY valid JSON.
Do NOT use markdown. Do NOT wrap in backticks.

Expected JSON structure:

${documentType === 'po' ? `{
  "poNumber": "",
  "poDate": "",
  "vendorName": "",
  "items": [{ "itemCode": "", "description": "", "quantity": 0 }]
}` : documentType === 'grn' ? `{
  "grnNumber": "",
  "poNumber": "",
  "grnDate": "",
  "items": [{ "itemCode": "", "description": "", "receivedQuantity": 0 }]
}` : `{
  "invoiceNumber": "",
  "poNumber": "",
  "invoiceDate": "",
  "items": [{ "itemCode": "", "description": "", "quantity": 0 }]
}`}
`.trim();

/**
 * Parses a document file using Gemini API.
 * Tries models in order; falls back on 404/429 errors.
 */
const parseDocument = async (filePath, mimeType, documentType) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = buildPrompt(documentType);
    const filePart = {
        inlineData: {
            data: fs.readFileSync(filePath).toString('base64'),
            mimeType,
        },
    };

    let lastError;

    for (const modelName of MODELS) {
        try {
            console.log(`Parsing with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await generateWithRetry(model, [prompt, filePart]);

            let text = result.response.text()
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .trim();

            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('No valid JSON found in Gemini response');

            return JSON.parse(match[0]);
        } catch (err) {
            const status = err?.status
                || (err?.message?.includes('429') ? 429 : null)
                || (err?.message?.includes('404') ? 404 : null);

            lastError = err;
            console.error(`Model "${modelName}" failed (${status ?? 'unknown'}): ${err.message}`);

            if (status !== 429 && status !== 404) break; // non-recoverable error
        }
    }

    throw new Error(`Gemini parsing failed: ${lastError?.message}`);
};

module.exports = { parseDocument };