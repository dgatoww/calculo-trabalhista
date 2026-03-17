import React, { useState, useEffect } from 'react';
import CaseList from './components/CaseList';
import UploadSection from './components/UploadSection';
import DataReview from './components/DataReview';
import CalculationResult from './components/CalculationResult';
import api from './services/api';

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  header: {
    backgroundColor: '#1F4E79',
    color: 'white',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '0.5px'
  },
  headerSubtitle: {
    fontSize: '13px',
    opacity: 0.8,
    marginTop: '2px'
  },
  headerLogo: {
    display: 'flex',
    flexDirection: 'column'
  },
  backBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 16px'
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    backgroundColor: 'white',
    padding: '8px',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    marginBottom: '24px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    transition: 'all 0.2s',
    backgroundColor: 'transparent',
    color: '#4a5568'
  },
  tabActive: {
    backgroundColor: '#2E74B5',
    color: 'white',
    boxShadow: '0 2px 4px rgba(46,116,181,0.3)'
  },
  tabDone: {
    color: '#38a169'
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    color: '#4a5568'
  },
  breadcrumbLink: {
    color: '#2E74B5',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    marginLeft: '8px'
  },
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  loadingBox: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '32px 48px',
    textAlign: 'center',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #2E74B5',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px'
  }
};

const STATUS_LABELS = {
  pending: { label: 'Pendente', color: '#ed8936', bg: '#fef3c7' },
  documents_uploaded: { label: 'Documentos enviados', color: '#2E74B5', bg: '#dbeafe' },
  data_reviewed: { label: 'Dados revisados', color: '#805ad5', bg: '#ede9fe' },
  calculated: { label: 'Calculado', color: '#38a169', bg: '#d1fae5' }
};

const TABS = [
  { id: 'upload', label: '1. Documentos', icon: '📄' },
  { id: 'review', label: '2. Revisar Dados', icon: '✏️' },
  { id: 'results', label: '3. Resultados', icon: '📊' }
];

function App() {
  const [view, setView] = useState('list'); // 'list' | 'case'
  const [selectedCase, setSelectedCase] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [cases, setCases] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const openCase = async (caseId) => {
    setLoading(true);
    setLoadingMessage('Carregando processo...');
    try {
      const caseData = await api.getCase(caseId);
      setSelectedCase(caseData);

      // Determine which tab to open based on status
      if (caseData.status === 'calculated') {
        setActiveTab('results');
      } else if (caseData.status === 'data_reviewed' || caseData.status === 'documents_uploaded') {
        setActiveTab('review');
      } else {
        setActiveTab('upload');
      }

      setView('case');
    } catch (error) {
      console.error('Failed to open case:', error);
      alert('Erro ao abrir processo: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const refreshCase = async () => {
    if (selectedCase) {
      try {
        const updated = await api.getCase(selectedCase.id);
        setSelectedCase(updated);
      } catch (err) {
        console.error('Failed to refresh case:', err);
      }
    }
  };

  const handleCaseCreated = (newCase) => {
    setRefreshKey(k => k + 1);
    openCase(newCase.id);
  };

  const goToList = () => {
    setView('list');
    setSelectedCase(null);
    setRefreshKey(k => k + 1);
  };

  const statusInfo = selectedCase ? (STATUS_LABELS[selectedCase.status] || STATUS_LABELS.pending) : null;

  const getTabStatus = (tabId) => {
    if (!selectedCase) return 'default';
    const status = selectedCase.status;

    if (tabId === 'upload') {
      return status !== 'pending' ? 'done' : 'default';
    }
    if (tabId === 'review') {
      return status === 'data_reviewed' || status === 'calculated' ? 'done' : 'default';
    }
    if (tabId === 'results') {
      return status === 'calculated' ? 'done' : 'default';
    }
    return 'default';
  };

  return (
    <div style={styles.app}>
      {/* Loading Overlay */}
      {loading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingBox}>
            <div style={styles.spinner}></div>
            <p style={{ fontSize: '15px', color: '#4a5568', fontWeight: '500' }}>
              {loadingMessage || 'Aguarde...'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLogo}>
          <div style={styles.headerTitle}>⚖️ Cálculo Trabalhista</div>
          <div style={styles.headerSubtitle}>Sistema de Cálculo de Verbas Rescisórias</div>
        </div>
        {view === 'case' && (
          <button style={styles.backBtn} onClick={goToList}>
            ← Voltar à Lista
          </button>
        )}
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {view === 'list' ? (
          <CaseList
            key={refreshKey}
            onOpenCase={openCase}
            onCaseCreated={handleCaseCreated}
            setLoading={setLoading}
            setLoadingMessage={setLoadingMessage}
          />
        ) : (
          <div>
            {/* Breadcrumb */}
            <div style={styles.breadcrumb}>
              <span style={styles.breadcrumbLink} onClick={goToList}>Processos</span>
              <span>›</span>
              <span style={{ fontWeight: '600', color: '#1a202c' }}>
                {selectedCase?.name}
              </span>
              {statusInfo && (
                <span style={{
                  ...styles.statusBadge,
                  color: statusInfo.color,
                  backgroundColor: statusInfo.bg
                }}>
                  {statusInfo.label}
                </span>
              )}
            </div>

            {/* Tab Navigation */}
            <div style={styles.tabBar}>
              {TABS.map(tab => {
                const tabStatus = getTabStatus(tab.id);
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    style={{
                      ...styles.tab,
                      ...(isActive ? styles.tabActive : {}),
                      ...(tabStatus === 'done' && !isActive ? styles.tabDone : {})
                    }}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tabStatus === 'done' && !isActive ? '✓ ' : tab.icon + ' '}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === 'upload' && (
              <UploadSection
                caseData={selectedCase}
                onUploadComplete={async () => {
                  await refreshCase();
                }}
                setLoading={setLoading}
                setLoadingMessage={setLoadingMessage}
                onGoToReview={() => {
                  refreshCase();
                  setActiveTab('review');
                }}
              />
            )}

            {activeTab === 'review' && (
              <DataReview
                caseData={selectedCase}
                onDataSaved={async () => {
                  await refreshCase();
                  setActiveTab('results');
                }}
                setLoading={setLoading}
                setLoadingMessage={setLoadingMessage}
              />
            )}

            {activeTab === 'results' && (
              <CalculationResult
                caseData={selectedCase}
                setLoading={setLoading}
                setLoadingMessage={setLoadingMessage}
                onRecalculate={() => refreshCase()}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
