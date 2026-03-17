const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'calculo_trabalhista.db');

// We use a synchronous wrapper pattern around sql.js
// sql.js is an in-memory database; we persist to disk manually
let SQL = null;
let db = null;

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

function initDb() {
  if (db) return db;

  // sql.js must be initialized synchronously via sync workaround
  // We use the synchronous API pattern
  const sqlJsPath = require.resolve('sql.js');
  const wasmPath = path.join(path.dirname(sqlJsPath), 'sql-wasm.wasm');

  // Initialize synchronously using a shared buffer trick
  const sqlJs = require('sql.js');

  // Use synchronous init with wasm binary loaded from file
  let wasmBinary;
  try {
    wasmBinary = fs.readFileSync(wasmPath);
  } catch (e) {
    // Try alternate path
    const altWasmPath = path.join(path.dirname(require.resolve('sql.js/dist/sql-wasm.js')), 'sql-wasm.wasm');
    try {
      wasmBinary = fs.readFileSync(altWasmPath);
    } catch (e2) {
      console.log('WASM file not found at expected paths, trying to locate...');
      const possiblePaths = [
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'sql-wasm.wasm')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          wasmBinary = fs.readFileSync(p);
          break;
        }
      }
    }
  }

  return { wasmBinary };
}

// Async initialization - returns a promise
async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: file => {
      const possiblePaths = [
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
        path.join(__dirname, '..', 'node_modules', 'sql.js', file)
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
      }
      return file;
    }
  });

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      type TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      extracted_data TEXT,
      extraction_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS case_data (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      field TEXT NOT NULL,
      value TEXT,
      source TEXT,
      manually_edited INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, field)
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      result_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  saveDb();
  console.log('Database initialized:', dbPath);
  return db;
}

// Helper to run a query and return all results
function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper to run a query and return first result
function queryFirst(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] || null;
}

// Helper to run an INSERT/UPDATE/DELETE
function run(db, sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// Helper functions as async wrappers
const dbHelpers = {
  getDb,
  queryAll,
  queryFirst,
  run,

  // Cases
  createCase: async (id, name) => {
    const db = await getDb();
    run(db, `INSERT INTO cases (id, name, status, created_at, updated_at) VALUES (?, ?, 'pending', datetime('now'), datetime('now'))`, [id, name]);
  },

  getAllCases: async () => {
    const db = await getDb();
    return queryAll(db, `SELECT * FROM cases ORDER BY created_at DESC`);
  },

  getCaseById: async (id) => {
    const db = await getDb();
    return queryFirst(db, `SELECT * FROM cases WHERE id = ?`, [id]);
  },

  updateCaseStatus: async (status, id) => {
    const db = await getDb();
    run(db, `UPDATE cases SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
  },

  deleteCase: async (id) => {
    const db = await getDb();
    run(db, `DELETE FROM case_data WHERE case_id = ?`, [id]);
    run(db, `DELETE FROM documents WHERE case_id = ?`, [id]);
    run(db, `DELETE FROM calculations WHERE case_id = ?`, [id]);
    run(db, `DELETE FROM cases WHERE id = ?`, [id]);
  },

  // Documents
  createDocument: async (id, caseId, type, filename, originalName) => {
    const db = await getDb();
    run(db, `INSERT INTO documents (id, case_id, type, filename, original_name, extraction_status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`, [id, caseId, type, filename, originalName]);
  },

  updateDocumentExtraction: async (extractedData, status, id) => {
    const db = await getDb();
    run(db, `UPDATE documents SET extracted_data = ?, extraction_status = ? WHERE id = ?`, [extractedData, status, id]);
  },

  getDocumentsByCase: async (caseId) => {
    const db = await getDb();
    return queryAll(db, `SELECT * FROM documents WHERE case_id = ?`, [caseId]);
  },

  getDocumentById: async (id) => {
    const db = await getDb();
    return queryFirst(db, `SELECT * FROM documents WHERE id = ?`, [id]);
  },

  // Case data
  upsertCaseData: async (id, caseId, field, value, source) => {
    const db = await getDb();
    // Only upsert if not manually edited
    const existing = queryFirst(db, `SELECT * FROM case_data WHERE case_id = ? AND field = ?`, [caseId, field]);
    if (existing && existing.manually_edited == 1) {
      return; // Don't overwrite manual edits
    }
    if (existing) {
      run(db, `UPDATE case_data SET value = ?, source = ?, updated_at = datetime('now') WHERE case_id = ? AND field = ?`, [value, source, caseId, field]);
    } else {
      run(db, `INSERT INTO case_data (id, case_id, field, value, source, manually_edited, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`, [id, caseId, field, value, source]);
    }
  },

  forceUpsertCaseData: async (id, caseId, field, value, source, manuallyEdited = 0) => {
    const db = await getDb();
    const existing = queryFirst(db, `SELECT * FROM case_data WHERE case_id = ? AND field = ?`, [caseId, field]);
    if (existing) {
      run(db, `UPDATE case_data SET value = ?, source = ?, manually_edited = ?, updated_at = datetime('now') WHERE case_id = ? AND field = ?`, [value, source, manuallyEdited, caseId, field]);
    } else {
      run(db, `INSERT INTO case_data (id, case_id, field, value, source, manually_edited, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`, [id, caseId, field, value, source, manuallyEdited]);
    }
  },

  getCaseData: async (caseId) => {
    const db = await getDb();
    return queryAll(db, `SELECT * FROM case_data WHERE case_id = ?`, [caseId]);
  },

  getCaseDataField: async (caseId, field) => {
    const db = await getDb();
    return queryFirst(db, `SELECT * FROM case_data WHERE case_id = ? AND field = ?`, [caseId, field]);
  },

  // Calculations
  saveCalculation: async (id, caseId, resultData) => {
    const db = await getDb();
    run(db, `INSERT INTO calculations (id, case_id, result_data, created_at) VALUES (?, ?, ?, datetime('now'))`, [id, caseId, resultData]);
  },

  getLatestCalculation: async (caseId) => {
    const db = await getDb();
    return queryFirst(db, `SELECT * FROM calculations WHERE case_id = ? ORDER BY created_at DESC LIMIT 1`, [caseId]);
  }
};

module.exports = dbHelpers;
