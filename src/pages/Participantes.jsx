import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Search, Download, RefreshCw, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../context/toast-contexto';
import ExpandableRow from '../components/ExpandableRow';
import ConfirmDialog from '../components/ConfirmDialog';
import { TableRowSkeleton } from '../components/Skeleton';

const ITEMS_PER_PAGE = 25;

/**
 * Cabecera de columna ordenable.
 *
 * Vive fuera del componente de página a propósito. Definida dentro, React la
 * trataba como un tipo de componente nuevo en cada renderizado y desmontaba y
 * volvía a montar todas las cabeceras cada vez: se perdía el foco y la tabla
 * parpadeaba al escribir en el buscador.
 */
function SortHeader({ field, sortField, sortDir, onSort, children }) {
  const activa = sortField === field;
  // `aria-sort` es lo que anuncia el orden a un lector de pantalla. La flecha ya
  // distinguía la columna activa y la dirección, pero solo para quien la ve.
  const orden = activa ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th
      className={`sortable${activa ? ' sorted' : ''}`}
      onClick={() => onSort(field)}
      aria-sort={orden}
    >
      {children}
      <span className={`sort-arrow${activa ? ' active' : ''}${activa && sortDir === 'desc' ? ' desc' : ''}`}>
        ▲
      </span>
    </th>
  );
}

/**
 * Un grupo de filtro con su rótulo visible.
 *
 * Vive fuera del componente de página por lo mismo que `SortHeader`: definido
 * dentro, React lo trataría como un tipo nuevo en cada renderizado.
 */
function GrupoDeFiltro({ rotulo, opciones, valor, onCambio }) {
  return (
    <div className="filter-group">
      <span className="filter-group-label" aria-hidden="true">{rotulo}</span>
      <div className="filter-pills" role="group" aria-label={`Filtrar por ${rotulo.toLowerCase()}`}>
        {opciones.map(v => (
          <button
            key={v}
            className={`filter-pill${valor === v ? ' active' : ''}`}
            onClick={() => onCambio(v)}
            aria-pressed={valor === v}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Participantes({ registrosHook }) {
  const { data, loading, fetchRegistros, handleAprobarPago, handleEliminarRegistro, handleViewPdf, revokePdfUrl, exportToExcel } = registrosHook;
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterTaller, setFilterTaller] = useState('Todos');
  // El filtro puede venir dado por quien nos trajo aquí: la píldora de «pagos
  // pendientes» de la barra lateral llega con `Pendientes` puesto.
  const { state: navegacion } = useLocation();
  const [filterPago, setFilterPago] = useState(navegacion?.filtroPago || 'Todos');
  const [filterInstitucion, setFilterInstitucion] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Punto 14: Debounce del buscador (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // PDF modal
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
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
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      list = list.filter(r =>
        (r.nombre || '').toLowerCase().includes(term) ||
        (r.id_participante || '').toLowerCase().includes(term) ||
        (r.institucion || '').toLowerCase().includes(term) ||
        (r.correo || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [data, debouncedSearch, filterTaller, filterPago, filterInstitucion]);

  // Sorting
  const sortedRegistros = useMemo(() => {
    if (!sortField) return filteredRegistros;
    const sorted = [...filteredRegistros].sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'id': valA = a.id_participante || ''; valB = b.id_participante || ''; break;
        case 'nombre': valA = a.nombre || ''; valB = b.nombre || ''; break;
        case 'institucion': valA = a.institucion || ''; valB = b.institucion || ''; break;
        case 'taller': valA = a.taller || ''; valB = b.taller || ''; break;
        case 'pago': valA = a.pago_aprobado ? 1 : 0; valB = b.pago_aprobado ? 1 : 0; break;
        case 'asistencia': valA = a.asistio ? 1 : 0; valB = b.asistio ? 1 : 0; break;
        default: return 0;
      }
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return sorted;
  }, [filteredRegistros, sortField, sortDir]);

  // ── Paginación ──────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedRegistros.length / ITEMS_PER_PAGE));

  // Al cambiar los filtros se vuelve a la primera página. Se ajusta DURANTE el
  // render en vez de con un efecto: un efecto pintaba primero la página vieja
  // con los resultados nuevos y solo después corregía, provocando un
  // renderizado en cascada visible como parpadeo.
  const claveFiltros = `${debouncedSearch}|${filterTaller}|${filterPago}|${filterInstitucion}`;
  const [filtrosPrevios, setFiltrosPrevios] = useState(claveFiltros);
  if (claveFiltros !== filtrosPrevios) {
    setFiltrosPrevios(claveFiltros);
    setCurrentPage(1);
  }

  // La página no puede pasarse del total. Antes esto era otro efecto que
  // escribía estado; ahora se deriva, así que no puede quedar desfasado.
  const paginaActual = Math.min(currentPage, totalPages);

  const paginatedRegistros = useMemo(() => {
    const start = (paginaActual - 1) * ITEMS_PER_PAGE;
    return sortedRegistros.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedRegistros, paginaActual]);

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

  const onAprobarPago = (id) => {
    setConfirmAction({
      type: 'aprobar',
      id,
      title: 'Aprobar pago',
      message: `¿Confirmas aprobar el pago del participante ${id}?`,
      confirmText: 'Aprobar Pago',
      variant: 'warning',
    });
  };

  const onEliminarRegistro = (id) => {
    setConfirmAction({
      type: 'eliminar',
      id,
      title: 'Eliminar registro',
      message: `¿Estás seguro de que deseas eliminar permanentemente el registro de ${id}? Esta acción NO se puede deshacer y el participante recibirá un correo automático de cancelación.`,
      confirmText: 'Eliminar Registro',
      variant: 'danger',
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    try {
      if (type === 'aprobar') {
        await handleAprobarPago(id);
        showToast(`Pago de ${id} aprobado correctamente`, 'success');
        setSelectedPdf(null);
        revokePdfUrl();
      } else if (type === 'eliminar') {
        await handleEliminarRegistro(id);
        showToast(`Registro de ${id} eliminado permanentemente`, 'success');
        if (selectedPdf) {
          setSelectedPdf(null);
          revokePdfUrl();
        }
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setConfirmAction(null);
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Skeleton state: first load only
  const isFirstLoad = loading && (data.registros || []).length === 0;

  return (
    <div className="fade-in-up">
      {/* Page header */}
      <div className="page-header">
        <h1>
          Participantes
          <span className="count-badge">{filteredRegistros.length}</span>
        </h1>
        <div className="header-actions">
          <button onClick={() => exportToExcel(filteredRegistros)} className="btn btn-outline btn-header btn-excel">
            <Download size={15} /> Excel ({filteredRegistros.length})
          </button>
          <button onClick={onRefresh} className="btn btn-outline btn-header" disabled={loading} aria-label="Actualizar datos">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card fade-in-up filter-card" style={{ animationDelay: '0.05s' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <label htmlFor="search-participantes" className="sr-only">Buscar participantes</label>
            <Search size={16} className="search-input-icon" />
            <input
              id="search-participantes"
              type="text"
              placeholder="Buscar por ID, nombre, correo..."
              className="input-field search-input-field"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="filter-taller" className="sr-only">Filtrar por taller</label>
            <select id="filter-taller" className="input-field" value={filterTaller} onChange={e => setFilterTaller(e.target.value)}>
              {talleresUnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Los dos grupos iban seguidos, sin rótulo visible y empezando los dos
              por «Todos». Con las dos pastillas activas en amarillo, se leían
              como un solo grupo con dos selecciones. Los `aria-label` estaban
              bien puestos, pero un rótulo que solo existe para el lector de
              pantalla no ayuda a quien mira. */}
          <GrupoDeFiltro
            rotulo="Pago"
            opciones={['Todos', 'Pendientes', 'Confirmados']}
            valor={filterPago}
            onCambio={setFilterPago}
          />

          <GrupoDeFiltro
            rotulo="Institución"
            opciones={['Todos', 'UAA', 'Foráneos']}
            valor={filterInstitucion}
            onCambio={setFilterInstitucion}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card fade-in-up card-flush" style={{ animationDelay: '0.1s' }}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="id">ID</SortHeader>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="nombre">Participante</SortHeader>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="institucion">Institución</SortHeader>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="taller">Taller</SortHeader>
                <th>Perfil</th>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="pago">Pago</SortHeader>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="asistencia">Asistencia</SortHeader>
              </tr>
            </thead>
            <tbody>
              {isFirstLoad ? (
                <TableRowSkeleton />
              ) : (
                <>
                  {paginatedRegistros.map((r, i) => (
                    <ExpandableRow key={r.id_participante || i} registro={r} onAprobarPago={onAprobarPago} onEliminarRegistro={onEliminarRegistro} onViewPdf={onViewPdf} />
                  ))}
                  {sortedRegistros.length === 0 && (
                    <tr>
                      <td colSpan="8" className="empty-state">
                        No se encontraron registros.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <span className="pagination-info">
              Mostrando {((paginaActual - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(paginaActual * ITEMS_PER_PAGE, sortedRegistros.length)} de {sortedRegistros.length}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-outline pagination-btn"
                onClick={() => setCurrentPage(Math.max(1, paginaActual - 1))}
                disabled={paginaActual === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Mostrar: primera, última, y las cercanas a la actual
                  return page === 1 || page === totalPages || Math.abs(page - paginaActual) <= 1;
                })
                .reduce((acc, page, idx, arr) => {
                  // Agregar puntos suspensivos entre páginas no contiguas
                  if (idx > 0 && page - arr[idx - 1] > 1) {
                    acc.push(<span key={`dots-${page}`} className="pagination-dots">…</span>);
                  }
                  acc.push(
                    <button
                      key={page}
                      className={`btn pagination-btn${paginaActual === page ? ' pagination-btn-active' : ' btn-outline'}`}
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Ir a página ${page}`}
                      aria-current={paginaActual === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  );
                  return acc;
                }, [])}
              <button
                className="btn btn-outline pagination-btn"
                onClick={() => setCurrentPage(Math.min(totalPages, paginaActual + 1))}
                disabled={paginaActual === totalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Visor del documento.
       *
       * Va montado en `document.body` a propósito. El contenedor de la página
       * lleva `.fade-in-up`, cuya animación deja fijo un `transform:
       * translateY(0)`, y cualquier transform distinto de `none` convierte al
       * elemento en el bloque contenedor de sus descendientes `position:
       * fixed`. El overlay se creía pegado a la ventana y en realidad se
       * centraba respecto a la página entera: con la tabla de participantes
       * desplegada, la tarjeta arrancaba a media altura del documento y se
       * salía cientos de píxeles por debajo del borde inferior de la pantalla.
       * Quien abría un comprobante lo veía a medias, o no lo veía. */}
      {selectedPdf && createPortal(
        <div
          className="pdf-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Visor de credencial o comprobante"
          ref={modalRef}
          onClick={(e) => { if (e.target === e.currentTarget) closePdfModal(); }}
        >
          <div className="card pdf-modal-card">
            <div className="pdf-modal-header">
              <h3 id="modal-title">Credencial / Comprobante</h3>
              <button
                ref={closeButtonRef}
                onClick={closePdfModal}
                className="btn btn-outline btn-close-modal"
                aria-label="Cerrar visor"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="pdf-modal-body">
              {pdfLoading ? (
                <div className="pdf-modal-loading">
                  <RefreshCw size={32} className="spin" />
                  <p>Cargando documento...</p>
                </div>
              ) : pdfBlobUrl ? (
                // El visor del navegador ajusta por defecto al ancho, y un
                // comprobante en vertical dentro de un marco apaisado se
                // dibujaba tan grande que solo cabía su mitad superior.
                // `view=Fit` encaja la página completa; la barra de
                // herramientas se conserva para poder acercar y descargar.
                <iframe
                  src={`${pdfBlobUrl}#view=Fit&navpanes=0`}
                  title="Visor de comprobante PDF"
                />
              ) : (
                <p className="pdf-modal-error">Error al cargar el PDF.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmText={confirmAction?.confirmText}
        variant={confirmAction?.variant}
        onConfirm={executeConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
