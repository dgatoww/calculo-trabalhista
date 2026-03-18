const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { calcularTudo } = require('../services/calculadora');
const { getDb, saveDb } = require('../db/database');

router.post('/calcular', async (req, res) => {
  try {
    const dados = req.body;
    const resultado = calcularTudo(dados);

    const db = await getDb();
    const id = uuidv4();

    db.run(`
      INSERT INTO calculos (id, nome_reclamante, nome_reclamada, numero_processo, data_admissao, data_rescisao, ultimo_dia_trabalhado, salario, adiantamento, afastamentos, ferias_vencidas_periodos, resultado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      dados.nome_reclamante,
      dados.nome_reclamada,
      dados.numero_processo,
      dados.data_admissao,
      dados.data_rescisao,
      dados.ultimo_dia_trabalhado,
      dados.salario,
      dados.adiantamento,
      JSON.stringify(dados.afastamentos || []),
      dados.ferias_vencidas_periodos,
      JSON.stringify(resultado)
    ]);

    saveDb();

    res.json({ success: true, id, resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/historico', async (req, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT id, created_at, nome_reclamante, numero_processo, resultado FROM calculos ORDER BY created_at DESC LIMIT 20');
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.resultado = JSON.parse(row.resultado);
      rows.push(row);
    }
    stmt.free();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
