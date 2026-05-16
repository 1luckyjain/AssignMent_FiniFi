const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const parseDocument = async (filePath, mimeType, documentType) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `You are an expert data extractor. Extract structured JSON data from this ${documentType.toUpperCase()} document.
Return ONLY valid JSON without markdown wrapping.
Ensure it includes the following fields based on document type:
For PO: poNumber, poDate, vendorName, items (array of: itemCode or sku, description, quantity)
For GRN: grnNumber, poNumber, grnDate, items (array of: itemCode or sku, description, receivedQuantity)
For Invoice: invoiceNumber, poNumber, invoiceDate, items (array of: itemCode or sku, description, quantity)
Be precise and ensure all fields match exactly.`;

        const imageParts = [
            {
                inlineData: {
                    data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
                    mimeType
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        let responseText = result.response.text();
        
        // Clean up markdown if any
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(responseText);
    } catch (error) {
        console.error("Gemini Parsing Error:", error);
        throw new Error("Failed to parse document with Gemini: " + error.message);
    }
};

module.exports = { parseDocument };
