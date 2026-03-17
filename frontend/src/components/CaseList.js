import React, { useState, useEffect } from 'react';
import api from '../services/api';

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto'
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a202c'
  },
  pageSubtitle: {
    fontSize: '14px',
    color: '#718096',
    marginTop: '4px'
  },
  createBtn: {
    backgroundColor: '#2E74B5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 8px rgba(46,116,181,0.3)',
    transition: 'all 0.2s'
  },
  modal: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalBox: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '32px',
    width: '440px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '20px',
    color: '#1a202c'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  btnRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  cancelBtn: {
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  confirmBtn: {
    backgroundColor: '#2E74B5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  caseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px'
  },
  caseCard: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.2s'
  },
  caseCardHover: {
    border: '2px solid #2E74B5',
    boxShadow: '0 4px 16px rgba(46,116,181,0.2)'
  },
  caseName: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px'
  },
  caseDate: {
    fontSize: '12px',
    color: '#718096',
    marginBottom: '12px'
  },
  caseFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  docCount: {
    fontSize: '12px',
    color: '#718096'
  },
  deleteBtn: {
    color: '#e53e3e',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '500'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '15px',
    color: '#718096',
    marginBottom: '24px'
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    border: '1px solid #feb2b2',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#c53030',
    fontSize: '14px',
    marginBottom: '16px'
  },
  loadingText: {
    textAlign: 'center',
    padding: '40px',
    color: '#718096',
    fontSize: '15px'
  }
};

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: '#ed8936', bg: '#fef3c7' },
  documents_uploaded: { label: 'Docs Enviados', color: '#2E74B5', bg: '#dbeafe' },
  data_reviewed: { label: 'Revisado', color: '#805ad5', bg: '#ede9fe' },
  calculated: { label: 'Calculado', color: '#38a169', bg: '#d1fae5' }
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function CaseList({ onOpenCase, onCaseCreated, setLoading, setLoadingMessage }) {
  const [cases, setCases] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCaseName, setNewCaseName] = useState('');
  const [error, setError] = useState('');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setIsLoadingList(true);
    try {
      const data = await api.getCases();
      setCases(data);
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError('Erro ao carregar processos. Verifique se o servidor está rodando.');
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleCreate = async () => {
    if (!newCaseName.trim()) {
      setError('Por favor, informe o nome do processo.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Criando processo...');
    try {
      const newCase = await api.createCase(newCaseName.trim());
      setShowCreateModal(false);
      setNewCaseName('');
      setError('');
      onCaseCreated(newCase);
    } catch (err) {
      setError('Erro ao criar processo: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, caseId) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este processo? Todos os dados serão perdidos.')) {
      return;
    }

    setDeletingId(caseId);
    try {
      await api.deleteCase(caseId);
      setCases(cases.filter(c => c.id !== caseId));
    } catch (err) {
      alert('Erro ao excluir processo: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setShowCreateModal(false);
      setNewCaseName('');
      setError('');
    }
  };

  if (isLoadingList) {
    return <div style={styles.loadingText}>Carregando processos...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Processos</h1>
          <p style={styles.pageSubtitle}>
            {cases.length} processo{cases.length !== 1 ? 's' : ''} cadastrado{cases.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          style={styles.createBtn}
          onClick={() => setShowCreateModal(true)}
          onMouseEnter={e => e.target.style.backgroundColor = '#1F4E79'}
          onMouseLeave={e => e.target.style.backgroundColor = '#2E74B5'}
        >
          + Novo Processo
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {/* Cases Grid or Empty State */}
      {cases.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⚖️</div>
          <h2 style={styles.emptyTitle}>Nenhum processo cadastrado</h2>
          <p style={styles.emptyText}>
            Clique em "Novo Processo" para começar um cálculo de verbas rescisórias.
          </p>
          <button
            style={styles.createBtn}
            onClick={() => setShowCreateModal(true)}
          >
            + Criar Primeiro Processo
          </button>
        </div>
      ) : (
        <div style={styles.caseGrid}>
          {cases.map(c => {
            const statusConfig = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
            const isDeleting = deletingId === c.id;

            return (
              <div
                key={c.id}
                style={{
                  ...styles.caseCard,
                  ...(hoveredCard === c.id ? styles.caseCardHover : {}),
                  opacity: isDeleting ? 0.5 : 1
                }}
                onClick={() => !isDeleting && onOpenCase(c.id)}
                onMouseEnter={() => setHoveredCard(c.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div style={styles.caseName}>{c.name}</div>
                <div style={styles.caseDate}>
                  Criado em {formatDate(c.created_at)}
                </div>
                <div style={styles.caseFooter}>
                  <span style={{
                    ...styles.statusBadge,
                    color: statusConfig.color,
                    backgroundColor: statusConfig.bg
                  }}>
                    {statusConfig.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={styles.docCount}>
                      {c.document_count || 0} doc{c.document_count !== 1 ? 's' : ''}
                    </span>
                    <button
                      style={styles.deleteBtn}
                      onClick={(e) => handleDelete(e, c.id)}
                      title="Excluir processo"
                    >
                      {isDeleting ? '...' : '🗑 Excluir'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Novo Processo</h2>

            {error && <div style={styles.errorBox}>{error}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>Nome do Processo / Número</label>
              <input
                style={styles.input}
                type="text"
                value={newCaseName}
                onChange={e => {
                  setNewCaseName(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ex: João Silva × Empresa XYZ"
                autoFocus
              />
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '6px' }}>
                Use o nome do reclamante ou número do processo para identificação.
              </p>
            </div>

            <div style={styles.btnRow}>
              <button
                style={styles.cancelBtn}
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCaseName('');
                  setError('');
                }}
              >
                Cancelar
              </button>
              <button style={styles.confirmBtn} onClick={handleCreate}>
                Criar Processo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
