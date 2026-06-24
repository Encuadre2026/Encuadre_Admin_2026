import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, Download, RefreshCw, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ExpandableRow from '../components/ExpandableRow';

const ITEMS_PER_PAGE = 25;

export default function Participantes({ registrosHook }) {
  const { data, loading, fetchRegistros, handleAprobarPago, handleViewPdf, revokePdfUrl, exportToExcel } = registrosHook;
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTaller, setFilterTaller] = useState('Todos');
  const [filterPago, setFilterPago] = useState('Todos');
  const [filterInstitucion, setFilterInstitucion] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);

  // PDF modal
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const talleresUnicos = useMemo(() => {
    const t = new Set((data.registros || []).map(r => r.taller));
    return ['Todos', ...Array.from(t).sort()];
  }, [data]);

  const filteredRegistros = useMemo(() => {
    let list = data.registros || [];
    if (filterTaller !== 'Todos') list = list.filter(r => r.taller === filterTaller);
    if (filterPago === 'Pendientes') list = list.filter(r => !r.pago_aprobado);
    if (filterPago === 'Confirmados') list = list.filter(r => r.pago_aprobado);
    if (filterInstitucion === 'UAA') list = list.filter(r => (r.institucion || '').includes('UAA'));
    if (filterInstitucion === 'Foráneos') list = list.filter(r => !(r.institucion || '').includes('UAA'));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r =>
        (r.nombre || '').toLowerCase().includes(term) ||
        (r.id_participante || '').toLowerCase().includes(term) ||
        (r.institucion || '').toLowerCase().includes(term) ||
        (r.correo || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [data, searchTerm, filterTaller, filterPago, filterInstitucion]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredRegistros.length / ITEMS_PER_PAGE));
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRegistros.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRegistros, currentPage]);

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTaller, filterPago, filterInstitucion]);

  // Asegurar que la página actual no exceda el total
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const closePdfModal = useCallback(() => {
    setSelectedPdf(null);
    revokePdfUrl();
  }, [revokePdfUrl]);

  // Punto 11: Cerrar modal con Escape y focus trap
  useEffect(() => {
    if (!selectedPdf) return;

    // Enfocar el botón de cerrar al abrir el modal
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePdfModal();
        return;
      }
      // Focus trap: mantener el foco dentro del modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPdf, closePdfModal]);

  const onAprobarPago = async (id) => {
    if (!confirm(`¿Aprobar el pago para ${id}?`)) return;
    try {
      await handleAprobarPago(id);
      showToast(`Pago de ${id} aprobado correctamente`, 'success');
      setSelectedPdf(null);
      revokePdfUrl();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const onViewPdf = async (url) => {
    setSelectedPdf(url);
    setPdfLoading(true);
    setPdfBlobUrl(null);
    try {
      const blobUrl = await handleViewPdf(url);
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      showToast(err.message, 'error');
      setSelectedPdf(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const onRefresh = async () => {
    const ok = await fetchRegistros();
    if (ok) showToast('Datos actualizados', 'info');
  };

  return (
    <div className="fade-in-up">
      {/* Page header */}
      <div className="page-header">
        <h1>
          Participantes
          <span className="count-badge">{filteredRegistros.length}</span>
        </h1>
        <div className="header-actions">
          <button onClick={() => exportToExcel(filteredRegistros)} className="btn btn-outline" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
            <Download size={15} /> Excel
          </button>
          <button onClick={onRefresh} className="btn btn-outline" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} disabled={loading} aria-label="Actualizar datos">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card fade-in-up" style={{ marginBottom: '1.25rem', animationDelay: '0.05s', padding: '1rem 1.25rem' }}>
        <div className="filter-bar">
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
            <label htmlFor="search-participantes" className="sr-only">Buscar participantes</label>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="search-participantes"
              type="text"
              placeholder="Buscar por ID, nombre, correo..."
              className="input-field"
              style={{ width: '100%', paddingLeft: '2.25rem', fontSize: '0.85rem', padding: '0.5rem 0.75rem 0.5rem 2.25rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="filter-taller" className="sr-only">Filtrar por taller</label>
            <select id="filter-taller" className="input-field" value={filterTaller} onChange={e => setFilterTaller(e.target.value)} style={{ minWidth: '160px', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
              {talleresUnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="filter-pills" role="group" aria-label="Filtrar por estado de pago">
            {['Todos', 'Pendientes', 'Confirmados'].map(v => (
              <button key={v} className={`filter-pill${filterPago === v ? ' active' : ''}`} onClick={() => setFilterPago(v)} aria-pressed={filterPago === v}>
                {v}
              </button>
            ))}
          </div>

          <div className="filter-pills" role="group" aria-label="Filtrar por institución">
            {['Todos', 'UAA', 'Foráneos'].map(v => (
              <button key={v} className={`filter-pill${filterInstitucion === v ? ' active' : ''}`} onClick={() => setFilterInstitucion(v)} aria-pressed={filterInstitucion === v}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card fade-in-up" style={{ padding: 0, overflow: 'hidden', animationDelay: '0.1s' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem 0.5rem', width: '30px' }}></th>
                <th style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>ID</th>
                <th style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>Participante</th>
                <th style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>Institución</th>
                <th style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>Taller</th>
                <th style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>Perfil</th>
                <th style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>Pago</th>
                <th style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRegistros.map((r, i) => (
                <ExpandableRow key={r.id_participante || i} registro={r} onAprobarPago={onAprobarPago} onViewPdf={onViewPdf} />
              ))}
              {filteredRegistros.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No se encontraron registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <span className="pagination-info">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredRegistros.length)} de {filteredRegistros.length}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-outline pagination-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Mostrar: primera, última, y las cercanas a la actual
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                })
                .reduce((acc, page, idx, arr) => {
                  // Agregar puntos suspensivos entre páginas no contiguas
                  if (idx > 0 && page - arr[idx - 1] > 1) {
                    acc.push(<span key={`dots-${page}`} className="pagination-dots">…</span>);
                  }
                  acc.push(
                    <button
                      key={page}
                      className={`btn pagination-btn${currentPage === page ? ' pagination-btn-active' : ' btn-outline'}`}
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Ir a página ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  );
                  return acc;
                }, [])}
              <button
                className="btn btn-outline pagination-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Modal — Punto 11: Accesibilidad */}
      {selectedPdf && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          role="dialog"
          aria-modal="true"
          aria-label="Visor de credencial o comprobante"
          ref={modalRef}
          onClick={(e) => { if (e.target === e.currentTarget) closePdfModal(); }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0, minHeight: '40px', position: 'relative', zIndex: 10 }}>
              <h3 style={{ margin: 0 }} id="modal-title">Credencial / Comprobante</h3>
              <button
                ref={closeButtonRef}
                onClick={closePdfModal}
                className="btn btn-outline"
                style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-surface)' }}
                aria-label="Cerrar visor"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div style={{ height: 'calc(100% - 56px)', backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
              {pdfLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={32} className="spin" style={{ marginBottom: '1rem' }} />
                  <p>Cargando documento...</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe src={pdfBlobUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Visor de comprobante PDF" />
              ) : (
                <p style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '2rem' }}>Error al cargar el PDF.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
