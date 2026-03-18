const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'calculos.db');

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS calculos (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      nome_reclamante TEXT,
      nome_reclamada TEXT,
      numero_processo TEXT,
      data_admissao TEXT,
      data_rescisao TEXT,
      ultimo_dia_trabalhado TEXT,
      salario REAL,
      adiantamento REAL,
      dias_trabalhados_mes INTEGER,
      afastamentos TEXT,
      ferias_vencidas_periodos INTEGER,
      resultado TEXT
    )
  `);

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const dbPath = path.join(__dirname, 'calculos.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

module.exports = { getDb, saveDb };
