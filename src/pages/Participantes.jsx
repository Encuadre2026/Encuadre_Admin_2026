import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Search, SearchX, Inbox, AlertTriangle, Download, RefreshCw, XCircle, X, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useToast } from '../context/toast-contexto';
import ExpandableRow from '../components/ExpandableRow';
import ConfirmDialog from '../components/ConfirmDialog';
import EstadoVacio from '../components/EstadoVacio';
import { TableRowSkeleton } from '../components/Skeleton';

/**
 * Cuántas filas caben en una página.
 *
 * Eran 25, fijas. En un monitor de escritorio caben más de treinta, así que la
 * primera página siempre se quedaba corta; y quien revisa el padrón entero
 * acababa paseando por catorce páginas. `Infinity` es «todas»: son unos cientos
 * de filas, no un catálogo, y el navegador las pinta sin despeinarse.
 */
const OPCIONES_POR_PAGINA = [25, 50, 100, Infinity];
const CLAVE_FILAS = 'ENCUADRE_ADMIN_FILAS_POR_PAGINA';

/** La preferencia sobrevive a la recarga; si no vale, se usa la de siempre. */
function leerFilasPorPagina() {
  const guardado = Number(localStorage.getItem(CLAVE_FILAS));
  return OPCIONES_POR_PAGINA.includes(guardado) ? guardado : 25;
}

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
      {/* Era el carácter «▲». Un glifo se dibuja con la fuente que toque, no
          se alinea con la línea base del rótulo y no escala con él; a 12 px
          era una mancha. Dibujado, es un icono como los demás del panel. */}
      <span className={`sort-arrow${activa ? ' active' : ''}${activa && sortDir === 'desc' ? ' desc' : ''}`}>
        <ChevronUp size={16} aria-hidden="true" />
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
  const { data, loading, error, fetchRegistros, handleAprobarPago, handleEliminarRegistro, handleViewPdf, revokePdfUrl, exportToExcel } = registrosHook;
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
  const [filasPorPagina, setFilasPorPagina] = useState(leerFilasPorPagina);
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const campoBusqueda = useRef(null);

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

  // ── Filtros puestos ─────────────────────────────────────
  //
  // Eran tres controles en tres sitios distintos de la barra, y para volver al
  // padrón entero había que acordarse de cuáles se habían tocado. Aquí se ven
  // los que están puestos, y cada uno se quita solo.
  const limpiarFiltros = useCallback(() => {
    setSearchTerm('');
    setFilterTaller('Todos');
    setFilterPago('Todos');
    setFilterInstitucion('Todos');
  }, []);

  const filtrosActivos = [];
  if (debouncedSearch) {
    filtrosActivos.push({ rotulo: 'Búsqueda', valor: `«${debouncedSearch}»`, quitar: () => setSearchTerm('') });
  }
  if (filterTaller !== 'Todos') {
    filtrosActivos.push({ rotulo: 'Taller', valor: filterTaller, quitar: () => setFilterTaller('Todos') });
  }
  if (filterPago !== 'Todos') {
    filtrosActivos.push({ rotulo: 'Pago', valor: filterPago, quitar: () => setFilterPago('Todos') });
  }
  if (filterInstitucion !== 'Todos') {
    filtrosActivos.push({ rotulo: 'Institución', valor: filterInstitucion, quitar: () => setFilterInstitucion('Todos') });
  }
  const hayFiltros = filtrosActivos.length > 0;
  const totalRegistros = (data.registros || []).length;
  // Sin datos y con un fallo detrás, la tabla no está vacía: está incompleta.
  // Decir «todavía no hay registros» cuando lo que pasó es que el Worker no
  // respondió es afirmar algo que no se sabe.
  const falloLaCarga = Boolean(error) && !error.noAutorizado && totalRegistros === 0;

  // ── Paginación ──────────────────────────────────────────
  const totalPages = filasPorPagina === Infinity
    ? 1
    : Math.max(1, Math.ceil(sortedRegistros.length / filasPorPagina));

  // Al cambiar los filtros se vuelve a la primera página. Se ajusta DURANTE el
  // render en vez de con un efecto: un efecto pintaba primero la página vieja
  // con los resultados nuevos y solo después corregía, provocando un
  // renderizado en cascada visible como parpadeo.
  const claveFiltros = `${debouncedSearch}|${filterTaller}|${filterPago}|${filterInstitucion}|${filasPorPagina}`;
  const [filtrosPrevios, setFiltrosPrevios] = useState(claveFiltros);
  if (claveFiltros !== filtrosPrevios) {
    setFiltrosPrevios(claveFiltros);
    setCurrentPage(1);
  }

  // La página no puede pasarse del total. Antes esto era otro efecto que
  // escribía estado; ahora se deriva, así que no puede quedar desfasado.
  const paginaActual = Math.min(currentPage, totalPages);

  const paginatedRegistros = useMemo(() => {
    if (filasPorPagina === Infinity) return sortedRegistros;
    const start = (paginaActual - 1) * filasPorPagina;
    return sortedRegistros.slice(start, start + filasPorPagina);
  }, [sortedRegistros, paginaActual, filasPorPagina]);

  const cambiarFilasPorPagina = (valor) => {
    const numero = Number(valor);
    setFilasPorPagina(numero);
    localStorage.setItem(CLAVE_FILAS, String(numero));
  };

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

  // `/` lleva al buscador desde cualquier sitio de la página.
  //
  // Buscar es lo primero que se hace al llegar aquí —se valida un pago concreto,
  // de una persona concreta— y exigía apuntar y hacer clic cada vez. No se roba
  // la tecla si ya se está escribiendo en algún campo, ni con una ventana
  // abierta encima.
  useEffect(() => {
    if (selectedPdf || confirmAction) return;

    const alPulsar = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const activo = document.activeElement;
      const escribiendo = activo && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName) || activo.isContentEditable
      );
      if (escribiendo) return;
      e.preventDefault();
      campoBusqueda.current?.focus();
    };

    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [selectedPdf, confirmAction]);

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
  const primeraFila = filasPorPagina === Infinity ? 1 : (paginaActual - 1) * filasPorPagina + 1;
  const ultimaFila = filasPorPagina === Infinity
    ? sortedRegistros.length
    : Math.min(paginaActual * filasPorPagina, sortedRegistros.length);

  return (
    <div className="fade-in-up">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-titulo">
          <div className="rotulo-seccion">Panel · Participantes</div>
          <h1>
            Padrón
            {/* Un número suelto no dice si se está viendo el padrón entero o un
                trozo. Con filtros puestos, dice de cuántos. */}
            <span className="count-badge cifra">
              {hayFiltros ? `${filteredRegistros.length} de ${totalRegistros}` : filteredRegistros.length}
            </span>
          </h1>
          <p className="page-header-contexto">
            {hayFiltros
              ? 'Filtros puestos: la tabla no enseña el padrón entero.'
              : `${totalRegistros} registros en ${Math.max(0, talleresUnicos.length - 1)} talleres`}
          </p>
        </div>
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
              ref={campoBusqueda}
              type="text"
              placeholder="Buscar por nombre, correo o folio…  (/)"
              className="input-field search-input-field"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchTerm('');
                  e.currentTarget.blur();
                }
              }}
            />
            {searchTerm && (
              <button
                className="btn-limpiar-busqueda"
                onClick={() => { setSearchTerm(''); campoBusqueda.current?.focus(); }}
                aria-label="Borrar la búsqueda"
              >
                <X size={14} />
              </button>
            )}
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

        {hayFiltros && (
          <div className="filtros-activos">
            {filtrosActivos.map(f => (
              <button
                key={f.rotulo}
                className="chip-filtro"
                onClick={f.quitar}
                aria-label={`Quitar el filtro ${f.rotulo}: ${f.valor}`}
              >
                <span className="chip-filtro-rotulo">{f.rotulo}</span>
                <span className="chip-filtro-valor">{f.valor}</span>
                <X size={12} />
              </button>
            ))}
            <button className="btn-limpiar-filtros" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Cuántos quedan, para quien no ve la tabla cambiar bajo sus manos. */}
      <p className="sr-only" role="status" aria-live="polite">
        {sortedRegistros.length} registros
      </p>

      {/* Table */}
      <div className="card fade-in-up card-flush" style={{ animationDelay: '0.1s' }}>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Padrón de participantes inscritos</caption>
            <thead>
              <tr>
                <th></th>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="id">Folio</SortHeader>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="nombre">Participante</SortHeader>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="institucion">Institución</SortHeader>
                <SortHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} field="taller">Taller</SortHeader>
                {/* El perfil se fue a la celda de institución —las dos dicen
                    quién es esta persona— y esta columna la ocupan ahora los
                    dos documentos, que estaban repartidos entre aquella y la
                    de pago. */}
                <th>Documentos</th>
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
                      {/* «No se encontraron registros» valía para los dos casos
                          y no distinguía ninguno: que no haya nadie inscrito
                          todavía y que haya trescientos y los filtros no dejen
                          pasar a ninguno son cosas distintas, y solo una de las
                          dos se arregla desde aquí. */}
                      <td colSpan="8" className="empty-state">
                        {falloLaCarga ? (
                          <EstadoVacio
                            icono={AlertTriangle}
                            titulo="No se pudieron cargar los registros"
                            accion={{ texto: 'Reintentar', onClick: onRefresh }}
                          />
                        ) : hayFiltros ? (
                          <EstadoVacio
                            icono={SearchX}
                            titulo="Ningún registro coincide"
                            mensaje="Hay registros en el padrón, pero ninguno pasa los filtros puestos."
                            accion={{ texto: 'Limpiar filtros', onClick: limpiarFiltros }}
                          />
                        ) : (
                          <EstadoVacio
                            icono={Inbox}
                            titulo="Todavía no hay registros"
                            mensaje="En cuanto alguien complete su inscripción aparecerá en esta tabla."
                            accion={{ texto: 'Actualizar', onClick: onRefresh }}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {sortedRegistros.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-izquierda">
              <label htmlFor="filas-por-pagina" className="pagination-info">Filas</label>
              <select
                id="filas-por-pagina"
                className="input-field selector-filas"
                value={String(filasPorPagina)}
                onChange={(e) => cambiarFilasPorPagina(e.target.value)}
              >
                {OPCIONES_POR_PAGINA.map(v => (
                  <option key={String(v)} value={String(v)}>
                    {v === Infinity ? 'Todas' : v}
                  </option>
                ))}
              </select>
              <span className="pagination-info">
                Mostrando {primeraFila}–{ultimaFila} de {sortedRegistros.length}
              </span>
            </div>
            {totalPages > 1 && (
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
            )}
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
