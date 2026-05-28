import { useState, useMemo } from 'react';
import { Search, Download, RefreshCw, XCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ExpandableRow from '../components/ExpandableRow';

export default function Participantes({ registrosHook }) {
  const { data, loading, fetchRegistros, handleAprobarPago, handleViewPdf, exportToExcel } = registrosHook;
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTaller, setFilterTaller] = useState('Todos');
  const [filterPago, setFilterPago] = useState('Todos');
  const [filterInstitucion, setFilterInstitucion] = useState('Todos');

  // PDF modal
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

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
        r.nombre.toLowerCase().includes(term) ||
        r.id_participante.toLowerCase().includes(term) ||
        r.institucion.toLowerCase().includes(term) ||
        r.correo.toLowerCase().includes(term)
      );
    }
    return list;
  }, [data, searchTerm, filterTaller, filterPago, filterInstitucion]);

  const onAprobarPago = async (id) => {
    if (!confirm(`¿Aprobar el pago para ${id}?`)) return;
    try {
      await handleAprobarPago(id);
      showToast(`Pago de ${id} aprobado correctamente`, 'success');
      setSelectedPdf(null);
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
          <button onClick={onRefresh} className="btn btn-outline" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card fade-in-up" style={{ marginBottom: '1.25rem', animationDelay: '0.05s', padding: '1rem 1.25rem' }}>
        <div className="filter-bar">
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por ID, nombre, correo..."
              className="input-field"
              style={{ width: '100%', paddingLeft: '2.25rem', fontSize: '0.85rem', padding: '0.5rem 0.75rem 0.5rem 2.25rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select className="input-field" value={filterTaller} onChange={e => setFilterTaller(e.target.value)} style={{ minWidth: '160px', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
            {talleresUnicos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div className="filter-pills">
            {['Todos', 'Pendientes', 'Confirmados'].map(v => (
              <button key={v} className={`filter-pill${filterPago === v ? ' active' : ''}`} onClick={() => setFilterPago(v)}>
                {v}
              </button>
            ))}
          </div>

          <div className="filter-pills">
            {['Todos', 'UAA', 'Foráneos'].map(v => (
              <button key={v} className={`filter-pill${filterInstitucion === v ? ' active' : ''}`} onClick={() => setFilterInstitucion(v)}>
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
              {filteredRegistros.map((r, i) => (
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
      </div>

      {/* PDF Modal */}
      {selectedPdf && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Credencial / Comprobante</h3>
              <button onClick={() => setSelectedPdf(null)} className="btn btn-outline" style={{ padding: '0.5rem' }}>
                <XCircle size={20} />
              </button>
            </div>
            <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pdfLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={32} className="spin" style={{ marginBottom: '1rem' }} />
                  <p>Cargando documento...</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe src={pdfBlobUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF" />
              ) : (
                <p style={{ color: 'var(--color-danger)' }}>Error al cargar el PDF.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
