const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

// GET /api/cases - List all cases
router.get('/', async (req, res) => {
  try {
    const cases = await db.getAllCases();

    // Enrich with document count
    const enrichedCases = await Promise.all(cases.map(async c => {
      const documents = await db.getDocumentsByCase(c.id);
      const caseData = await db.getCaseData(c.id);

      return {
        ...c,
        document_count: documents.length,
        data_fields_count: caseData.length,
        documents: documents.map(d => ({
          id: d.id,
          type: d.type,
          original_name: d.original_name,
          extraction_status: d.extraction_status
        }))
      };
    }));

    res.json(enrichedCases);
  } catch (error) {
    console.error('Error listing cases:', error);
    res.status(500).json({ error: 'Erro ao listar processos', message: error.message });
  }
});

// POST /api/cases - Create new case
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nome do processo é obrigatório' });
    }

    const id = uuidv4();
    await db.createCase(id, name.trim());

    const newCase = await db.getCaseById(id);
    res.status(201).json(newCase);
  } catch (error) {
    console.error('Error creating case:', error);
    res.status(500).json({ error: 'Erro ao criar processo', message: error.message });
  }
});

// GET /api/cases/:id - Get case with all data
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = await db.getCaseById(id);

    if (!caseData) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const documents = await db.getDocumentsByCase(id);
    const fields = await db.getCaseData(id);
    const latestCalc = await db.getLatestCalculation(id);

    // Parse extracted_data for each document
    const enrichedDocuments = documents.map(doc => ({
      ...doc,
      extracted_data: doc.extracted_data ? JSON.parse(doc.extracted_data) : null
    }));

    // Convert fields array to object
    const dataFields = {};
    fields.forEach(f => {
      dataFields[f.field] = {
        value: f.value,
        source: f.source,
        manually_edited: f.manually_edited === 1 || f.manually_edited === '1',
        updated_at: f.updated_at
      };
    });

    res.json({
      ...caseData,
      documents: enrichedDocuments,
      data: dataFields,
      latest_calculation: latestCalc ? JSON.parse(latestCalc.result_data) : null
    });
  } catch (error) {
    console.error('Error getting case:', error);
    res.status(500).json({ error: 'Erro ao obter processo', message: error.message });
  }
});

// PUT /api/cases/:id/data - Update case data fields (manual correction)
router.put('/:id/data', async (req, res) => {
  try {
    const { id } = req.params;
    const { fields } = req.body;

    const caseData = await db.getCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'Campos inválidos' });
    }

    // Update each field with manual_edited flag
    for (const [field, value] of Object.entries(fields)) {
      const fieldId = uuidv4();
      await db.forceUpsertCaseData(fieldId, id, field, String(value), 'manual', 1);
    }

    // Update case status
    await db.updateCaseStatus('data_reviewed', id);

    // Return updated data
    const updatedFields = await db.getCaseData(id);
    const dataObj = {};
    updatedFields.forEach(f => {
      dataObj[f.field] = {
        value: f.value,
        source: f.source,
        manually_edited: f.manually_edited === 1 || f.manually_edited === '1',
        updated_at: f.updated_at
      };
    });

    res.json({ success: true, data: dataObj });
  } catch (error) {
    console.error('Error updating case data:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados', message: error.message });
  }
});

// DELETE /api/cases/:id - Delete case
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await db.getCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    await db.deleteCase(id);
    res.json({ success: true, message: 'Processo excluído com sucesso' });
  } catch (error) {
    console.error('Error deleting case:', error);
    res.status(500).json({ error: 'Erro ao excluir processo', message: error.message });
  }
});

module.exports = router;
