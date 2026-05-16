const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    documentType: {
        type: String,
        enum: ['po', 'grn', 'invoice'],
        required: true
    },
    poNumber: {
        type: String,
        required: true,
        index: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Document', DocumentSchema);
