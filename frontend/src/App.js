import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const TIPO_COLORS = {
  ata: '#2d5da1',
  movimentacoes: '#6a3fa0',
  ponto: '#c07a00',
  ficha: '#1a7a50',
  ferias: '#a03030',
};
const TIPO_ICONS = {
  ata: '⚖️',
  movimentacoes: '📋',
  ponto: '🕐',
  ficha: '💰',
  ferias: '🏖️',
};

// ─── DROP ZONE ────────────────────────────────────────────────────────────────
function DropZone({ onFilesUploaded, loading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const processFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    onFilesUploaded(formData, files);
  }, [onFilesUploaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !loading && inputRef.current.click()}
      style={{
        border: `3px dashed ${dragging ? '#2d5da1' : '#aaa'}`,
        borderRadius: 12,
        padding: '40px 24px',
        textAlign: 'center',
        background: dragging ? '#eef3ff' : '#fafafa',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        marginBottom: 24,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => processFiles(e.target.files)}
      />
      <div style={{ fontSize: 48 }}>{loading ? '⏳' : '📂'}</div>
      <p style={{ fontWeight: 'bold', fontSize: '1.1em', margin: '8px 0 4px', color: '#333' }}>
        {loading ? 'Processando arquivos...' : 'Arraste os PDFs aqui ou clique para selecionar'}
      </p>
      <p style={{ color: '#888', margin: 0, fontSize: '0.9em' }}>
        Selecione todos os PDFs de uma vez — o sistema identifica automaticamente cada tipo de documento
      </p>
    </div>
  );
}

// ─── FILE RESULT CARD ─────────────────────────────────────────────────────────
function FileResultCard({ result }) {
  const [showDebug, setShowDebug] = useState(false);
  const cor = TIPO_COLORS[result.tipo] || '#666';
  const icon = TIPO_ICONS[result.tipo] || '❓';

  return (
    <div style={{ border: `2px solid ${cor}`, borderRadius: 10, padding: 16, marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '1.2em' }}>{icon}</span>
          <strong style={{ marginLeft: 8, color: cor }}>{result.tipo_label}</strong>
          <span style={{ marginLeft: 8, color: '#888', fontSize: '0.85em' }}>{result.filename}</span>
        </div>
        {result.error
          ? <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>ERRO: {result.error}</span>
          : <span style={{ color: '#27ae60' }}>✓ Extraído</span>
        }
      </div>

      {/* Dados extraídos */}
      {!result.error && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(result.dados || {}).map(([k, v]) => {
            if (!v || k === '_debug' || (Array.isArray(v) && v.length === 0)) return null;
            const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const display = Array.isArray(v) ? `${v.length} registro(s)` : String(v);
            return (
              <span key={k} style={{ background: '#f0f4ff', padding: '4px 10px', borderRadius: 20, fontSize: '0.82em' }}>
                <strong>{label}:</strong> {display.substring(0, 40)}
              </span>
            );
          })}
        </div>
      )}

      {/* Debug toggle */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        style={{ marginTop: 10, background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8em', color: '#666' }}
      >
        {showDebug ? '▲ Ocultar debug' : '▼ Ver debug / texto bruto'}
      </button>

      {showDebug && (
        <div style={{ marginTop: 10, background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, fontSize: '0.78em', overflowX: 'auto' }}>
          <p style={{ color: '#9cdcfe', margin: '0 0 8px', fontWeight: 'bold' }}>DADOS EXTRAÍDOS (MATCHES):</p>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result.debug, null, 2)}
          </pre>
          <p style={{ color: '#9cdcfe', margin: '12px 0 8px', fontWeight: 'bold' }}>TEXTO BRUTO (primeiros 2000 chars):</p>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#ce9178' }}>
            {result.raw_text}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── RESULTADO ────────────────────────────────────────────────────────────────
function ResultadoCard({ resultado, dados }) {
  const handleDownload = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/export/docx`,
        { dados, resultado }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `calculo_trabalhista.docx`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Erro ao gerar documento: ' + err.message);
    }
  };

  const rows = [
    { label: 'Saldo de Salário', base: `${resultado.saldo_salario.diasTrabalhados} dias${resultado.saldo_salario.adiantamento > 0 ? ` - ${formatCurrency(resultado.saldo_salario.adiantamento)} adiant.` : ''}`, valor: resultado.saldo_salario.valorLiquido },
    { label: '13º Salário Prop.', base: `${resultado.decimo_terceiro.avos}/12 avos`, valor: resultado.decimo_terceiro.valor },
    { label: 'Férias Vencidas', base: `${resultado.ferias_vencidas.periodos} período(s) × 1,3333`, valor: resultado.ferias_vencidas.valor },
    { label: 'Férias Proporcionais', base: `${resultado.ferias_proporcionais.avos}/12 avos × 1,3333`, valor: resultado.ferias_proporcionais.valor },
  ];

  return (
    <div>
      <h2 style={{ color: '#1a3a6b', textAlign: 'center', marginBottom: 24 }}>RESULTADO DO CÁLCULO</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ background: '#1a3a6b', color: 'white' }}>
            {['Verba', 'Base de Cálculo', 'Valor'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} style={{ background: i % 2 === 1 ? '#f9f9f9' : 'white' }}>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>{r.label}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', color: '#555' }}>{r.base}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 600, color: '#1a7a1a', textAlign: 'right' }}>{formatCurrency(r.valor)}</td>
            </tr>
          ))}
          <tr style={{ background: '#e8f5e9' }}>
            <td colSpan={2} style={{ padding: '14px 16px', fontWeight: 'bold', fontSize: '1.1em', borderTop: '3px solid #4CAF50' }}>TOTAL GERAL</td>
            <td style={{ padding: '14px 16px', fontWeight: 'bold', fontSize: '1.2em', color: '#1a7a1a', textAlign: 'right', borderTop: '3px solid #4CAF50' }}>{formatCurrency(resultado.total)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center' }}>
        <button onClick={handleDownload} style={{ padding: '12px 32px', background: '#2d5da1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1em', fontWeight: 'bold' }}>
          ⬇ Exportar para Word (.docx)
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [fileResults, setFileResults] = useState([]);
  const [formData, setFormData] = useState({
    nome_reclamante: '', nome_reclamada: '', numero_processo: '',
    data_admissao: '', data_rescisao: '', ultimo_dia_trabalhado: '',
    salario: '', adiantamento: '0', ferias_vencidas_periodos: '0',
    afastamentos: []
  });
  const [resultado, setResultado] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [newAfast, setNewAfast] = useState({ tipo: 'beneficio_comum', inicio: '', fim: '' });

  const handleFilesUploaded = useCallback(async (formDataObj) => {
    setUploadLoading(true);
    setFileResults([]);
    try {
      const resp = await axios.post(`${API_URL}/api/upload/auto`, formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFileResults(resp.data.results);

      // Preencher formulário com dados mesclados
      const merged = resp.data.mergedData;
      if (merged) {
        setFormData(prev => {
          const upd = { ...prev };
          const fields = ['nome_reclamante', 'nome_reclamada', 'numero_processo',
            'data_admissao', 'data_rescisao', 'ultimo_dia_trabalhado', 'salario'];
          for (const f of fields) {
            if (merged[f] && !upd[f]) upd[f] = String(merged[f]);
          }
          // Sobrescrever mesmo se existir para esses campos
          if (merged.salario) upd.salario = String(merged.salario);
          if (merged.adiantamento) upd.adiantamento = String(merged.adiantamento);
          if (merged.ferias_vencidas_periodos !== undefined) upd.ferias_vencidas_periodos = String(merged.ferias_vencidas_periodos);
          if (merged.afastamentos && merged.afastamentos.length > 0) {
            upd.afastamentos = [...(prev.afastamentos || []), ...merged.afastamentos];
          }
          return upd;
        });
      }
    } catch (err) {
      alert('Erro ao processar arquivos: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadLoading(false);
    }
  }, []);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const addAfast = () => {
    if (!newAfast.inicio || !newAfast.fim) return;
    setFormData(prev => ({ ...prev, afastamentos: [...(prev.afastamentos || []), { ...newAfast }] }));
    setNewAfast({ tipo: 'beneficio_comum', inicio: '', fim: '' });
  };

  const removeAfast = (i) =>
    setFormData(prev => ({ ...prev, afastamentos: prev.afastamentos.filter((_, idx) => idx !== i) }));

  const handleCalcular = async () => {
    setCalcLoading(true);
    setCalcError('');
    try {
      const payload = {
        ...formData,
        salario: parseFloat(String(formData.salario).replace(',', '.')),
        adiantamento: parseFloat(String(formData.adiantamento).replace(',', '.')) || 0,
        ferias_vencidas_periodos: parseInt(formData.ferias_vencidas_periodos) || 0,
      };
      const resp = await axios.post(`${API_URL}/api/calculos/calcular`, payload);
      setResultado(resp.data.resultado);
      setActiveTab('resultado');
    } catch (err) {
      setCalcError('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setCalcLoading(false);
    }
  };

  const preenchido = (name) => !!formData[name];
  const inp = (extra = {}) => ({
    padding: '8px 12px', border: '2px solid #ddd', borderRadius: 6,
    fontSize: '0.95em', outline: 'none', width: '100%', boxSizing: 'border-box', ...extra
  });

  const FIELDS = [
    { name: 'numero_processo', label: 'Número do Processo', ph: '0000000-00.0000.0.00.0000' },
    { name: 'nome_reclamante', label: 'Reclamante', ph: 'Nome completo' },
    { name: 'nome_reclamada', label: 'Reclamada', ph: 'Razão social' },
    { name: 'data_admissao', label: 'Data de Admissão', ph: 'DD/MM/AAAA' },
    { name: 'data_rescisao', label: 'Data de Rescisão', ph: 'DD/MM/AAAA' },
    { name: 'ultimo_dia_trabalhado', label: 'Último Dia Trabalhado', ph: 'DD/MM/AAAA' },
    { name: 'salario', label: 'Salário (R$)', ph: '1780.00' },
    { name: 'adiantamento', label: 'Adiantamento (R$)', ph: '0.00' },
    { name: 'ferias_vencidas_periodos', label: 'Períodos de Férias Vencidas', ph: '0' },
  ];

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
      <header style={{ background: 'linear-gradient(135deg, #1a3a6b, #2d5da1)', color: 'white', padding: '24px', borderRadius: '0 0 12px 12px', marginBottom: 24, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.8em' }}>⚖️ Cálculo de Verbas Rescisórias</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.85 }}>Sistema automatizado para cálculo trabalhista</p>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'upload', label: '📄 Upload PDFs' },
          { id: 'dados', label: '📝 Dados' },
          { id: 'resultado', label: '📊 Resultado' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '10px 20px', border: '2px solid', borderRadius: 8,
            cursor: 'pointer', fontWeight: 600,
            borderColor: activeTab === id ? '#2d5da1' : '#ddd',
            color: activeTab === id ? '#2d5da1' : '#555',
            background: activeTab === id ? '#eef3ff' : 'white',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div>
            <div style={{ background: '#f0f4ff', border: '1px solid #c5d5f5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '0.9em', color: '#2d4a8a' }}>
              <strong>Como usar:</strong> Selecione ou arraste <strong>todos os PDFs de uma vez</strong> — ata de audiência, cartão de ponto, ficha financeira, histórico de movimentações e histórico de férias. O sistema detecta automaticamente o tipo de cada documento.
            </div>

            <DropZone onFilesUploaded={handleFilesUploaded} loading={uploadLoading} />

            {uploadLoading && (
              <div style={{ textAlign: 'center', padding: 20, color: '#2d5da1' }}>
                <div style={{ fontSize: 32 }}>⏳</div>
                <p>Extraindo dados dos PDFs...</p>
              </div>
            )}

            {fileResults.length > 0 && (
              <div>
                <h3 style={{ color: '#1a3a6b', marginBottom: 12 }}>
                  {fileResults.length} arquivo(s) processado(s)
                </h3>
                {fileResults.map((r, i) => <FileResultCard key={i} result={r} />)}
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <button onClick={() => setActiveTab('dados')} style={{ padding: '12px 32px', background: '#2d5da1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1em', fontWeight: 'bold' }}>
                    Revisar Dados →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DADOS TAB */}
        {activeTab === 'dados' && (
          <div>
            <h2 style={{ color: '#1a3a6b', borderBottom: '2px solid #eee', paddingBottom: 8 }}>Dados do Processo</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
              {FIELDS.map(({ name, label, ph }) => (
                <div key={name}>
                  <label style={{ display: 'block', fontWeight: 600, color: '#333', fontSize: '0.9em', marginBottom: 4 }}>
                    {label} {preenchido(name) && <span style={{ color: '#27ae60' }}>✓</span>}
                  </label>
                  <input
                    name={name} value={formData[name]} onChange={handleChange} placeholder={ph}
                    style={inp({ borderColor: preenchido(name) ? '#4CAF50' : '#ddd' })}
                  />
                </div>
              ))}
            </div>

            <h2 style={{ color: '#1a3a6b', borderBottom: '2px solid #eee', paddingBottom: 8 }}>Afastamentos</h2>
            <p style={{ color: '#666', background: '#fff8e1', padding: '8px 12px', borderRadius: 6, fontSize: '0.9em', marginBottom: 12 }}>
              🏥 <strong>AUX.DOENÇA</strong> — não conta para avos &nbsp;|&nbsp; 👶 <strong>LIC.MATERNIDADE</strong> — conta para avos
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 16, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 600, marginBottom: 4 }}>Tipo</label>
                <select value={newAfast.tipo} onChange={e => setNewAfast(p => ({ ...p, tipo: e.target.value }))} style={inp()}>
                  <option value="beneficio_comum">🏥 AUX.DOENÇA</option>
                  <option value="licenca_maternidade">👶 LIC.MATERNIDADE</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 600, marginBottom: 4 }}>Início</label>
                <input placeholder="DD/MM/AAAA" value={newAfast.inicio} onChange={e => setNewAfast(p => ({ ...p, inicio: e.target.value }))} style={inp()} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 600, marginBottom: 4 }}>Fim</label>
                <input placeholder="DD/MM/AAAA" value={newAfast.fim} onChange={e => setNewAfast(p => ({ ...p, fim: e.target.value }))} style={inp()} />
              </div>
              <button onClick={addAfast} style={{ padding: '8px 16px', background: '#2d5da1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', height: 38 }}>+ Add</button>
            </div>

            {formData.afastamentos?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                {formData.afastamentos.map((af, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee', marginBottom: 8 }}>
                    <span style={{ color: af.tipo === 'beneficio_comum' ? '#c0700a' : '#1a7a50', fontWeight: 600 }}>
                      {af.tipo === 'beneficio_comum' ? '🏥 AUX.DOENÇA' : '👶 LIC.MATERNIDADE'}
                    </span>
                    <span style={{ color: '#555' }}>{af.inicio} → {af.fim}</span>
                    <button onClick={() => removeAfast(i)} style={{ marginLeft: 'auto', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {calcError && <p style={{ color: '#e74c3c', background: '#fef', padding: '10px 14px', borderRadius: 6 }}>{calcError}</p>}

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={handleCalcular} disabled={calcLoading} style={{ padding: '14px 48px', background: '#1a7a1a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', opacity: calcLoading ? 0.7 : 1 }}>
                {calcLoading ? '⏳ Calculando...' : '🧮 CALCULAR VERBAS'}
              </button>
            </div>
          </div>
        )}

        {/* RESULTADO TAB */}
        {activeTab === 'resultado' && resultado && (
          <ResultadoCard resultado={resultado} dados={formData} />
        )}
        {activeTab === 'resultado' && !resultado && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
            <p style={{ fontSize: '1.1em' }}>Nenhum cálculo realizado ainda.</p>
            <button onClick={() => setActiveTab('dados')} style={{ padding: '12px 32px', background: '#2d5da1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Ir para Dados</button>
          </div>
        )}
      </div>
    </div>
  );
}
