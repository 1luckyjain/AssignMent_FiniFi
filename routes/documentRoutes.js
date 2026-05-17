const express = require('express');
const multer = require('multer');
const router = express.Router();
const { uploadDocument, getDocument } = require('../controllers/documentController');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/:id', getDocument);

module.exports = router;
