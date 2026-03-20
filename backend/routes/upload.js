const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const pdfExtractor = require('../services/pdfExtractor');
const { calculateAvosFerias } = require('../services/calculator');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];
  if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Use PDF ou imagens (PNG, JPG, TIFF).'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Document type mapping
const DOCUMENT_TYPES = {
  'termo_audiencia': 'Termo de Audiência',
  'cartao_ponto': 'Cartão de Ponto',
  'ficha_financeira': 'Ficha Financeira',
  'historico_movimentacoes': 'Histórico de Movimentações',
  'historico_ferias': 'Histórico de Férias'
};

// POST /api/cases/:id/upload - Upload and extract data from PDF
router.post('/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { document_type } = req.body;

    // Validate case exists
    const caseData = await db.getCaseById(id);
    if (!caseData) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    if (!document_type || !DOCUMENT_TYPES[document_type]) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Tipo de documento inválido',
        valid_types: Object.keys(DOCUMENT_TYPES)
      });
    }

    // Create document record
    const docId = uuidv4();
    await db.createDocument(docId, id, document_type, req.file.filename, req.file.originalname);

    // Extract data
    try {
      console.log(`Extracting data from ${document_type}: ${req.file.originalname}`);
      const extractedData = await pdfExtractor.extractFromDocument(req.file.path, document_type);

      // Save extracted data
      await db.updateDocumentExtraction(JSON.stringify(extractedData), 'completed', docId);

      // Merge into case_data
      if (extractedData && extractedData.fields) {
        for (const [field, value] of Object.entries(extractedData.fields)) {
          if (value !== null && value !== undefined && value !== '') {
            const fieldId = uuidv4();
            if (document_type === 'termo_audiencia') {
              // Termo de audiência has priority — force overwrite non-manual fields
              await db.forceUpsertCaseData(fieldId, id, field, String(value), document_type, 0);
            } else {
              await db.upsertCaseData(fieldId, id, field, String(value), document_type);
            }
          }
        }
      }

      // Compute avos_ferias_proporcionais if data_admissao and data_rescisao are now available
      try {
        const allFields = await db.getCaseData(id);
        const caseFields = {};
        allFields.forEach(f => { caseFields[f.field] = f.value; });
        if (caseFields.data_admissao && caseFields.data_rescisao) {
          const afastamentos = caseFields.afastamentos ? JSON.parse(caseFields.afastamentos) : [];
          const avos = calculateAvosFerias(caseFields.data_admissao, caseFields.data_rescisao, afastamentos);
          if (avos > 0) {
            await db.upsertCaseData(uuidv4(), id, 'avos_ferias_proporcionais', String(avos), 'computed');
          }
        }
      } catch (e) {
        console.warn('Could not compute avos_ferias_proporcionais:', e.message);
      }

      // Update case status
      await db.updateCaseStatus('documents_uploaded', id);

      res.json({
        success: true,
        document: {
          id: docId,
          type: document_type,
          type_label: DOCUMENT_TYPES[document_type],
          filename: req.file.filename,
          original_name: req.file.originalname,
          extraction_status: 'completed',
          extracted_data: extractedData
        }
      });

    } catch (extractError) {
      console.error('Extraction error:', extractError);

      await db.updateDocumentExtraction(JSON.stringify({ error: extractError.message }), 'error', docId);

      res.json({
        success: true,
        document: {
          id: docId,
          type: document_type,
          type_label: DOCUMENT_TYPES[document_type],
          filename: req.file.filename,
          original_name: req.file.originalname,
          extraction_status: 'error',
          extraction_error: extractError.message
        },
        warning: 'Arquivo enviado, mas houve erro na extração automática. Por favor, preencha os dados manualmente.'
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erro no upload', message: error.message });
  }
});

// GET /api/cases/:id/documents - List documents for a case
router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const documents = await db.getDocumentsByCase(id);

    const enriched = documents.map(doc => ({
      ...doc,
      extracted_data: doc.extracted_data ? JSON.parse(doc.extracted_data) : null,
      type_label: DOCUMENT_TYPES[doc.type] || doc.type
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Erro ao listar documentos', message: error.message });
  }
});

module.exports = router;
