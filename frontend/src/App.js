import React, { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

function UploadCard({ tipo, titulo, descricao, onDataExtracted }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setStatus('Extraindo dados...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload/${tipo}`, formData);
      setStatus('Dados extraídos com sucesso!');
      onDataExtracted(tipo, response.data.dados);
    } catch (err) {
      setError('Erro ao processar arquivo: ' + (err.response?.data?.error || err.message));
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{titulo}</h3>
      <p style={styles.cardDesc}>{descricao}</p>
      <input
        type="file"
        accept=".pdf"
        onChange={handleUpload}
        disabled={loading}
        style={styles.fileInput}
      />
      {loading && <p style={styles.loading}>Processando...</p>}
      {status && <p style={styles.success}>{status}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

function ResultadoCard({ resultado, dados }) {
  const handleDownload = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/export/docx`,
        { dados, resultado },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `calculo_trabalhista.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Erro ao gerar documento: ' + err.message);
    }
  };

  return (
    <div style={styles.resultCard}>
      <h2 style={styles.resultTitle}>RESULTADO DO CÁLCULO</h2>

      <table style={styles.table}>
        <thead>
          <tr style={styles.tableHeader}>
            <th style={styles.th}>Verba</th>
            <th style={styles.th}>Base de Cálculo</th>
            <th style={styles.th}>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.td}>Saldo de Salário</td>
            <td style={styles.td}>{resultado.saldo_salario.diasTrabalhados} dias {resultado.saldo_salario.adiantamento > 0 ? `(- ${formatCurrency(resultado.saldo_salario.adiantamento)} adiant.)` : ''}</td>
            <td style={{...styles.td, ...styles.tdValue}}>{formatCurrency(resultado.saldo_salario.valorLiquido)}</td>
          </tr>
          <tr style={styles.trAlt}>
            <td style={styles.td}>13º Salário Prop.</td>
            <td style={styles.td}>{resultado.decimo_terceiro.avos}/12 avos</td>
            <td style={{...styles.td, ...styles.tdValue}}>{formatCurrency(resultado.decimo_terceiro.valor)}</td>
          </tr>
          <tr>
            <td style={styles.td}>Férias Vencidas</td>
            <td style={styles.td}>{resultado.ferias_vencidas.periodos} período(s) × 1,3333</td>
            <td style={{...styles.td, ...styles.tdValue}}>{formatCurrency(resultado.ferias_vencidas.valor)}</td>
          </tr>
          <tr style={styles.trAlt}>
            <td style={styles.td}>Férias Proporcionais</td>
            <td style={styles.td}>{resultado.ferias_proporcionais.avos}/12 avos × 1,3333</td>
            <td style={{...styles.td, ...styles.tdValue}}>{formatCurrency(resultado.ferias_proporcionais.valor)}</td>
          </tr>
          <tr style={styles.trTotal}>
            <td style={{...styles.td, fontWeight: 'bold'}} colSpan={2}>TOTAL GERAL</td>
            <td style={{...styles.td, fontWeight: 'bold', fontSize: '1.2em', color: '#1a7a1a'}}>{formatCurrency(resultado.total)}</td>
          </tr>
        </tbody>
      </table>

      <button onClick={handleDownload} style={styles.btnDownload}>
        Exportar para Word (.docx)
      </button>
    </div>
  );
}

export default function App() {
  const [formData, setFormData] = useState({
    nome_reclamante: '',
    nome_reclamada: '',
    numero_processo: '',
    data_admissao: '',
    data_rescisao: '',
    ultimo_dia_trabalhado: '',
    salario: '',
    adiantamento: '0',
    ferias_vencidas_periodos: '0',
    afastamentos: []
  });

  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newAfastamento, setNewAfastamento] = useState({ tipo: 'beneficio_comum', inicio: '', fim: '' });
  const [activeTab, setActiveTab] = useState('upload');

  const handleDataExtracted = useCallback((tipo, dados) => {
    setFormData(prev => {
      const updated = { ...prev };
      switch (tipo) {
        case 'ata':
          if (dados.nome_reclamante) updated.nome_reclamante = dados.nome_reclamante;
          if (dados.nome_reclamada) updated.nome_reclamada = dados.nome_reclamada;
          if (dados.numero_processo) updated.numero_processo = dados.numero_processo;
          if (dados.data_rescisao) updated.data_rescisao = dados.data_rescisao;
          if (dados.data_admissao && !updated.data_admissao) updated.data_admissao = dados.data_admissao;
          break;
        case 'movimentacoes':
          if (dados.nome) updated.nome_reclamante = dados.nome;
          if (dados.data_admissao) updated.data_admissao = dados.data_admissao;
          if (dados.salario) updated.salario = String(dados.salario);
          if (dados.afastamentos && dados.afastamentos.length > 0) {
            updated.afastamentos = [...(prev.afastamentos || []), ...dados.afastamentos];
          }
          break;
        case 'ponto':
          if (dados.ultimo_dia_trabalhado) updated.ultimo_dia_trabalhado = dados.ultimo_dia_trabalhado;
          break;
        case 'ficha':
          if (dados.adiantamento) updated.adiantamento = String(dados.adiantamento);
          if (dados.salario_base && !updated.salario) updated.salario = String(dados.salario_base);
          break;
        case 'ferias':
          if (dados.ferias_vencidas_periodos !== undefined) updated.ferias_vencidas_periodos = String(dados.ferias_vencidas_periodos);
          break;
        default: break;
      }
      return updated;
    });
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addAfastamento = () => {
    if (!newAfastamento.inicio || !newAfastamento.fim) return;
    setFormData(prev => ({
      ...prev,
      afastamentos: [...(prev.afastamentos || []), { ...newAfastamento }]
    }));
    setNewAfastamento({ tipo: 'beneficio_comum', inicio: '', fim: '' });
  };

  const removeAfastamento = (idx) => {
    setFormData(prev => ({
      ...prev,
      afastamentos: prev.afastamentos.filter((_, i) => i !== idx)
    }));
  };

  const handleCalcular = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...formData,
        salario: parseFloat(String(formData.salario).replace(',', '.')),
        adiantamento: parseFloat(String(formData.adiantamento).replace(',', '.')) || 0,
        ferias_vencidas_periodos: parseInt(formData.ferias_vencidas_periodos) || 0,
      };
      const response = await axios.post(`${API_URL}/api/calculos/calcular`, payload);
      setResultado(response.data.resultado);
      setActiveTab('resultado');
    } catch (err) {
      setError('Erro ao calcular: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (name) => ({
    ...styles.input,
    borderColor: formData[name] ? '#4CAF50' : '#ddd'
  });

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Cálculo de Verbas Rescisórias</h1>
        <p style={styles.headerSub}>Sistema automatizado para cálculo trabalhista</p>
      </header>

      <div style={styles.tabs}>
        {['upload', 'dados', 'resultado'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
          >
            {tab === 'upload' ? 'Upload PDFs' : tab === 'dados' ? 'Dados' : 'Resultado'}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'upload' && (
          <div>
            <p style={styles.hint}>Faça upload dos documentos para extração automática dos dados. Todos os campos são preenchidos automaticamente.</p>
            <div style={styles.grid}>
              <UploadCard tipo="ata" titulo="Ata de Audiência" descricao="PDF do PJe/TRT com dados do processo, reclamante e data de rescisão" onDataExtracted={handleDataExtracted} />
              <UploadCard tipo="movimentacoes" titulo="Hist. Movimentações" descricao="Relatório 11.003 com salário, cargo e afastamentos" onDataExtracted={handleDataExtracted} />
              <UploadCard tipo="ponto" titulo="Cartão de Ponto" descricao="Registros de ponto para identificar o último dia trabalhado" onDataExtracted={handleDataExtracted} />
              <UploadCard tipo="ficha" titulo="Ficha Financeira" descricao="Relatório 11.013 com adiantamentos e salário base" onDataExtracted={handleDataExtracted} />
              <UploadCard tipo="ferias" titulo="Hist. de Férias" descricao="Relatório 11.004 com períodos aquisitivos de férias" onDataExtracted={handleDataExtracted} />
            </div>
            <div style={styles.nextBtn}>
              <button onClick={() => setActiveTab('dados')} style={styles.btnPrimary}>Continuar - Revisar Dados</button>
            </div>
          </div>
        )}

        {activeTab === 'dados' && (
          <div>
            <h2 style={styles.sectionTitle}>Dados do Processo</h2>
            <div style={styles.formGrid}>
              {[
                { name: 'numero_processo', label: 'Número do Processo', placeholder: '0000000-00.0000.0.00.0000' },
                { name: 'nome_reclamante', label: 'Reclamante', placeholder: 'Nome completo' },
                { name: 'nome_reclamada', label: 'Reclamada', placeholder: 'Razão social' },
                { name: 'data_admissao', label: 'Data de Admissão', placeholder: 'DD/MM/AAAA' },
                { name: 'data_rescisao', label: 'Data de Rescisão', placeholder: 'DD/MM/AAAA' },
                { name: 'ultimo_dia_trabalhado', label: 'Último Dia Trabalhado', placeholder: 'DD/MM/AAAA' },
                { name: 'salario', label: 'Salário (R$)', placeholder: '1780.00' },
                { name: 'adiantamento', label: 'Adiantamento (R$)', placeholder: '0.00' },
                { name: 'ferias_vencidas_periodos', label: 'Períodos de Férias Vencidas', placeholder: '0' },
              ].map(field => (
                <div key={field.name} style={styles.formGroup}>
                  <label style={styles.label}>{field.label}</label>
                  <input
                    name={field.name}
                    value={formData[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    style={inputStyle(field.name)}
                  />
                </div>
              ))}
            </div>

            <h2 style={styles.sectionTitle}>Afastamentos</h2>
            <p style={styles.hint}>AUX.DOENÇA não conta para avos. LIC.MATERNIDADE conta para avos.</p>

            <div style={styles.afastGrid}>
              <select value={newAfastamento.tipo} onChange={e => setNewAfastamento(p => ({...p, tipo: e.target.value}))} style={styles.select}>
                <option value="beneficio_comum">AUX.DOENÇA (não conta avos)</option>
                <option value="licenca_maternidade">LIC.MATERNIDADE (conta avos)</option>
              </select>
              <input type="text" placeholder="Início DD/MM/AAAA" value={newAfastamento.inicio} onChange={e => setNewAfastamento(p => ({...p, inicio: e.target.value}))} style={styles.input} />
              <input type="text" placeholder="Fim DD/MM/AAAA" value={newAfastamento.fim} onChange={e => setNewAfastamento(p => ({...p, fim: e.target.value}))} style={styles.input} />
              <button onClick={addAfastamento} style={styles.btnAdd}>+ Adicionar</button>
            </div>

            {formData.afastamentos && formData.afastamentos.length > 0 && (
              <div style={styles.afastList}>
                {formData.afastamentos.map((af, idx) => (
                  <div key={idx} style={styles.afastItem}>
                    <span style={{ color: af.tipo === 'beneficio_comum' ? '#e67e22' : '#27ae60' }}>
                      {af.tipo === 'beneficio_comum' ? 'AUX.DOENÇA' : 'LIC.MATERNIDADE'}
                    </span>
                    <span>{af.inicio} a {af.fim}</span>
                    <button onClick={() => removeAfastamento(idx)} style={styles.btnRemove}>X</button>
                  </div>
                ))}
              </div>
            )}

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.nextBtn}>
              <button onClick={handleCalcular} disabled={loading} style={styles.btnCalc}>
                {loading ? 'Calculando...' : 'CALCULAR VERBAS'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'resultado' && resultado && (
          <ResultadoCard resultado={resultado} dados={formData} />
        )}

        {activeTab === 'resultado' && !resultado && (
          <div style={styles.emptyResult}>
            <p>Nenhum cálculo realizado ainda.</p>
            <button onClick={() => setActiveTab('dados')} style={styles.btnPrimary}>Ir para Dados</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  app: { fontFamily: 'Arial, sans-serif', maxWidth: '1100px', margin: '0 auto', padding: '0 16px' },
  header: { background: 'linear-gradient(135deg, #1a3a6b, #2d5da1)', color: 'white', padding: '24px', borderRadius: '0 0 12px 12px', marginBottom: '24px', textAlign: 'center' },
  headerTitle: { margin: 0, fontSize: '1.8em' },
  headerSub: { margin: '8px 0 0', opacity: 0.85 },
  tabs: { display: 'flex', gap: '8px', marginBottom: '24px' },
  tab: { padding: '10px 20px', border: '2px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#555' },
  tabActive: { borderColor: '#2d5da1', color: '#2d5da1', background: '#eef3ff' },
  content: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: { border: '2px dashed #ccc', borderRadius: '8px', padding: '16px', background: '#fafafa' },
  cardTitle: { margin: '0 0 8px', color: '#1a3a6b' },
  cardDesc: { color: '#666', fontSize: '0.85em', margin: '0 0 12px' },
  fileInput: { width: '100%' },
  loading: { color: '#2d5da1', fontSize: '0.9em' },
  success: { color: '#27ae60', fontSize: '0.9em', fontWeight: 'bold' },
  error: { color: '#e74c3c', fontSize: '0.9em', padding: '8px', background: '#fef', borderRadius: '4px', margin: '8px 0' },
  hint: { color: '#666', background: '#f0f4ff', padding: '10px', borderRadius: '6px', marginBottom: '16px' },
  nextBtn: { textAlign: 'center', marginTop: '24px' },
  btnPrimary: { padding: '12px 32px', background: '#2d5da1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1em' },
  btnCalc: { padding: '14px 40px', background: '#1a7a1a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' },
  sectionTitle: { color: '#1a3a6b', borderBottom: '2px solid #eee', paddingBottom: '8px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontWeight: '600', color: '#333', fontSize: '0.9em' },
  input: { padding: '8px 12px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '0.95em', outline: 'none' },
  select: { padding: '8px 12px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '0.95em' },
  afastGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '16px', alignItems: 'center' },
  btnAdd: { padding: '8px 16px', background: '#2d5da1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  afastList: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' },
  afastItem: { display: 'flex', gap: '16px', alignItems: 'center', padding: '10px', background: '#f9f9f9', borderRadius: '6px', border: '1px solid #eee' },
  btnRemove: { marginLeft: 'auto', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' },
  resultCard: { padding: '8px' },
  resultTitle: { color: '#1a3a6b', textAlign: 'center', marginBottom: '24px' },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: '24px' },
  tableHeader: { background: '#1a3a6b', color: 'white' },
  th: { padding: '12px', textAlign: 'left', fontWeight: 'bold' },
  td: { padding: '12px', borderBottom: '1px solid #eee' },
  tdValue: { fontWeight: '600', color: '#1a7a1a', textAlign: 'right' },
  trAlt: { background: '#f9f9f9' },
  trTotal: { background: '#e8f5e9', borderTop: '3px solid #4CAF50' },
  btnDownload: { display: 'block', margin: '0 auto', padding: '12px 32px', background: '#2d5da1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1em', fontWeight: 'bold' },
  emptyResult: { textAlign: 'center', padding: '40px', color: '#666' },
};
