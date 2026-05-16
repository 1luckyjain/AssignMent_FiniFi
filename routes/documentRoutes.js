const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadDocument, getDocument } = require('../controllers/documentController');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/:id', getDocument);

module.exports = router;
