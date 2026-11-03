import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle, Download, Mail, RefreshCw, Search, X, XCircle } from 'lucide-react';
import { useToast } from '../context/toast-contexto';
import { ErrorApi, pedir } from '../api/cliente';
import { esAsamblea } from '../asamblea';
import ConfirmDialog from '../components/ConfirmDialog';
import EstadoVacio from '../components/EstadoVacio';

/**
 * La entrega de los reconocimientos.
 *
 * Al terminar el Encuentro cada persona recibe el suyo por correo y además lo
 * puede bajar de su portal. Esta pantalla es desde donde se dispara ese envío,
 * y desde donde se mira uno antes de mandar nada.
 *
 * Quién tiene derecho NO se decide aquí. Lo dice la API en cada fila del padrón
 * (`reconocimiento_disponible`), por la misma razón que el reparto de cupos
 * tampoco se recalcula en el panel: el mínimo de asistencias se cambia desde
 * Cloudflare y esta aplicación se despliega aparte, así que una copia de la
 * regla aquí enseñaría el reparto viejo sin que nadie se entere. El panel
 * muestra; no decide.
 */

/** Los filtros de la tabla. El orden es el de la lista de arriba abajo. */
const FILTROS = [
  { clave: 'pendientes', rotulo: 'Pendientes de envío' },
  { clave: 'enviados', rotulo: 'Ya enviados' },
  { clave: 'sin-derecho', rotulo: 'Sin derecho' },
  { clave: 'todos', rotulo: 'Todos' },
];

/** Cuántas personas entran en cada llamada. El Worker no admite más de 25. */
const POR_LOTE = 25;

const numero = new Intl.NumberFormat('es-MX');

function fechaCorta(valor) {
  if (!valor) return '';
  // D1 escribe «2026-10-31 18:00:00», en UTC y sin marca de zona: sin la Z,
  // el navegador la interpretaría como hora local y la adelantaría seis horas.
  const fecha = new Date(valor.replace(' ', 'T') + 'Z');
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Descarga un blob con el nombre que diga la cabecera, o uno de respaldo. */
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Revocar en el mismo turno cancela la descarga en Safari; un turno después
  // el navegador ya tomó los bytes.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Reconocimientos({ registrosHook }) {
  const { data, loading, soloLectura, fetchRegistros } = registrosHook;
  const { showToast } = useToast();

  const [filtro, setFiltro] = useState('pendientes');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState(null);
  const [descargando, setDescargando] = useState(null);

  // El envío: si está corriendo, cuánto lleva y si hay que confirmarlo.
  const [porEnviar, setPorEnviar] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [avance, setAvance] = useState(null);

  // El editor de casos sueltos.
  const [tipoLibre, setTipoLibre] = useState('participante');
  const [nombreLibre, setNombreLibre] = useState('');
  const [ponenciaLibre, setPonenciaLibre] = useState('');
  const [generandoLibre, setGenerandoLibre] = useState(false);

  const registros = useMemo(() => data.registros || [], [data.registros]);

  const cargarEstado = useCallback(async () => {
    try {
      setEstado(await pedir('/api/admin/reconocimientos/estado'));
    } catch (err) {
      // El recuento es un extra: si falla, la tabla sigue sirviendo y no tiene
      // sentido tapar la pantalla con un error.
      showToast(err.message, 'error');
    }
  }, [showToast]);

  // El recuento del servidor, al montar. La regla avisa de que un efecto no
  // debe escribir estado, pero aquí no escribe ninguno de forma síncrona:
  // `cargarEstado` no toca `estado` hasta después del `await`, que es el caso
  // que la propia regla admite para traer datos. El padrón se carga en
  // `useRegistros`; esto es solo el total que la API calcula con su regla.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarEstado();
  }, [cargarEstado]);

  const resumen = useMemo(() => {
    const conDerecho = registros.filter((r) => r.reconocimiento_disponible);
    const enviados = conDerecho.filter((r) => r.fecha_reconocimiento_enviado);
    return {
      elegibles: conDerecho.length,
      enviados: enviados.length,
      pendientes: conDerecho.length - enviados.length,
      sinDerecho: registros.length - conDerecho.length,
    };
  }, [registros]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return registros
      .filter((r) => {
        const conDerecho = Boolean(r.reconocimiento_disponible);
        const enviado = Boolean(r.fecha_reconocimiento_enviado);
        if (filtro === 'pendientes') return conDerecho && !enviado;
        if (filtro === 'enviados') return enviado;
        if (filtro === 'sin-derecho') return !conDerecho;
        return true;
      })
      .filter((r) => {
        if (!texto) return true;
        return [r.nombre, r.id_participante, r.correo, r.institucion]
          .filter(Boolean)
          .some((campo) => campo.toLowerCase().includes(texto));
      });
  }, [registros, filtro, busqueda]);

  const onRefresh = async () => {
    const ok = await fetchRegistros();
    await cargarEstado();
    if (ok) showToast('Datos actualizados', 'info');
  };

  /** Baja el PDF de alguien del padrón, tal y como lo va a recibir. */
  const verElSuyo = async (registro) => {
    setDescargando(registro.id_participante);
    try {
      const blob = await pedir(
        `/api/admin/reconocimiento?id=${encodeURIComponent(registro.id_participante)}`,
        { esperaBinario: true }
      );
      descargar(blob, `Reconocimiento - ${registro.nombre}.pdf`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDescargando(null);
    }
  };

  const generarLibre = async (e) => {
    e.preventDefault();
    const nombre = nombreLibre.trim();
    const ponencia = ponenciaLibre.trim();
    if (!nombre) return;
    if (tipoLibre === 'ponente' && !ponencia) return;

    setGenerandoLibre(true);
    try {
      const parametros = new URLSearchParams({ tipo: tipoLibre, nombre });
      // Solo la plantilla de ponente lo lleva impreso; en las otras dos el
      // Worker lo ignora, pero mandarlo sería decir algo que no es.
      if (tipoLibre === 'ponente') parametros.set('ponencia', ponencia);

      const blob = await pedir(`/api/admin/reconocimiento?${parametros}`, {
        esperaBinario: true,
      });
      descargar(blob, `Reconocimiento - ${nombre}.pdf`);
      showToast('Reconocimiento generado.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerandoLibre(false);
    }
  };

  /**
   * Pregunta a cuánta gente le tocaría, sin mandar nada.
   *
   * Es el paso previo obligado del envío: la confirmación dice un número que
   * sale del servidor y no de lo que el panel tenga cargado, que puede llevar
   * minutos sin refrescarse.
   */
  const pedirConfirmacion = async () => {
    try {
      const simulacion = await pedir('/api/admin/reconocimientos/enviar', {
        method: 'POST',
        body: JSON.stringify({ simulacion: true }),
      });
      if (simulacion.pendientes === 0) {
        showToast('No queda nadie pendiente.', 'info');
        return;
      }
      setPorEnviar(simulacion.pendientes);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /**
   * Manda en tandas hasta que no quede nadie.
   *
   * El bucle está aquí y no en el Worker porque el padrón entero no cabe en el
   * tiempo de una invocación, y porque así hay algo que enseñar mientras tanto:
   * cada vuelta actualiza el avance. Un fallo corta el bucle en vez de seguir
   * —si el correo está caído, insistir 20 veces no arregla nada— y lo ya
   * mandado queda marcado en la base, así que volver a pulsar retoma donde se
   * quedó sin repetirle a nadie.
   */
  const enviarTodo = async () => {
    setPorEnviar(null);
    setEnviando(true);
    setAvance({ enviados: 0, fallidos: 0, pendientes: null });

    let enviados = 0;
    let fallidos = 0;

    try {
      for (;;) {
        const lote = await pedir('/api/admin/reconocimientos/enviar', {
          method: 'POST',
          body: JSON.stringify({ limite: POR_LOTE }),
        });

        enviados += lote.enviados;
        fallidos += lote.fallidos;
        setAvance({ enviados, fallidos, pendientes: lote.pendientes });

        // Sin esta salida el bucle sería infinito cuando todo lo que queda
        // falla: `pendientes` no bajaría nunca porque nadie se marca.
        if (lote.pendientes === 0 || lote.enviados === 0) break;
      }

      if (fallidos > 0) {
        showToast(
          `Se mandaron ${enviados}. Quedaron ${fallidos} sin salir: vuelve a intentarlo.`,
          'error'
        );
      } else {
        showToast(`Se mandaron ${enviados} reconocimientos.`, 'success');
      }
    } catch (err) {
      const mensaje = err instanceof ErrorApi ? err.message : 'Se cortó el envío.';
      showToast(`${mensaje} Lo ya mandado quedó registrado; vuelve a pulsar para seguir.`, 'error');
    } finally {
      setEnviando(false);
      await fetchRegistros();
      await cargarEstado();
    }
  };

  const hayFiltros = filtro !== 'todos' || busqueda.trim() !== '';
  const minimo = estado?.minimo_de_asistencias;

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <div className="page-header-titulo">
          <div className="rotulo-seccion">Panel · Reconocimientos</div>
          <h1>
            Reconocimientos
            <span className="count-badge cifra">{numero.format(resumen.pendientes)}</span>
          </h1>
          <p className="page-header-contexto">
            {minimo === undefined
              ? 'Cargando el criterio de entrega…'
              : `Le toca a la asamblea entera y a quien acumule ${minimo} asistencia${minimo === 1 ? '' : 's'} o más.`}
          </p>
        </div>
        <div className="header-actions">
          {!soloLectura && (
            <button
              onClick={pedirConfirmacion}
              className="btn btn-primary btn-header"
              disabled={enviando || loading || resumen.pendientes === 0}
            >
              <Mail size={15} /> Enviar a los pendientes ({numero.format(resumen.pendientes)})
            </button>
          )}
          <button
            onClick={onRefresh}
            className="btn btn-outline btn-header"
            disabled={loading || enviando}
            aria-label="Actualizar datos"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* El avance del envío. Solo mientras corre o justo al acabar: una barra
          permanente a cero no dice nada. */}
      {avance && (
        <div className="card" style={{ marginBottom: 'var(--espacio-4)' }}>
          <p className="rotulo-seccion">{enviando ? 'Enviando…' : 'Último envío'}</p>
          <p className="kpi-sub" aria-live="polite">
            {numero.format(avance.enviados)} enviados
            {avance.fallidos > 0 && ` · ${numero.format(avance.fallidos)} sin salir`}
            {avance.pendientes !== null && ` · ${numero.format(avance.pendientes)} por delante`}
          </p>
        </div>
      )}

      <div className="dashboard-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Con derecho</span>
          <h2 className="kpi-value">{numero.format(resumen.elegibles)}</h2>
          <p className="kpi-sub">de {numero.format(registros.length)} del padrón</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Ya enviados</span>
          <h2 className="kpi-value">{numero.format(resumen.enviados)}</h2>
          <p className="kpi-sub">por correo, con el PDF adjunto</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Pendientes</span>
          <h2 className="kpi-value">{numero.format(resumen.pendientes)}</h2>
          <p className="kpi-sub">les toca y todavía no sale</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Sin derecho</span>
          <h2 className="kpi-value">{numero.format(resumen.sinDerecho)}</h2>
          <p className="kpi-sub">no llegan al mínimo</p>
        </div>
      </div>

      {!soloLectura && (
        <div className="card" style={{ marginBottom: 'var(--espacio-4)' }}>
          <p className="rotulo-seccion">Uno suelto</p>
          <p className="kpi-sub" style={{ margin: 'var(--espacio-2) 0 var(--espacio-4)' }}>
            Para corregirle el nombre a quien lo escribió mal al registrarse, y para
            quien no está en el padrón. Se descarga, no se manda por correo.
          </p>
          <form
            onSubmit={generarLibre}
            className="filter-bar"
            style={{ alignItems: 'flex-end' }}
          >
            <div className="input-group">
              <label className="input-label" htmlFor="tipo-libre">
                Plantilla
              </label>
              <select
                id="tipo-libre"
                className="input-field"
                value={tipoLibre}
                onChange={(e) => setTipoLibre(e.target.value)}
              >
                <option value="participante">Participante</option>
                <option value="asambleista">Asambleísta</option>
                <option value="ponente">Ponente</option>
              </select>
            </div>
            <div className="input-group" style={{ flex: '1 1 280px' }}>
              <label className="input-label" htmlFor="nombre-libre">
                Nombre, como va a salir impreso
              </label>
              <input
                id="nombre-libre"
                className="input-field"
                value={nombreLibre}
                onChange={(e) => setNombreLibre(e.target.value)}
                placeholder="Mtra. en Hip. Laura Reyes Tiscareño"
                maxLength={120}
              />
            </div>
            <button
              type="submit"
              className="btn btn-outline"
              disabled={
                generandoLibre ||
                nombreLibre.trim() === '' ||
                (tipoLibre === 'ponente' && ponenciaLibre.trim() === '')
              }
            >
              <Download size={15} /> {generandoLibre ? 'Generando…' : 'Descargar'}
            </button>
          </form>

          {/* El título solo existe en la plantilla de ponente, y ahí es
              obligatorio: el cartón dice «con la ponencia:» y el hueco no se
              puede entregar en blanco. Va en su propio renglón porque es el
              campo más largo de los tres. */}
          {tipoLibre === 'ponente' && (
            <div className="input-group" style={{ marginTop: 'var(--espacio-4)' }}>
              <label className="input-label" htmlFor="ponencia-libre">
                Título de la ponencia, como va a salir impreso
              </label>
              <textarea
                id="ponencia-libre"
                className="input-field"
                rows={2}
                value={ponenciaLibre}
                onChange={(e) => setPonenciaLibre(e.target.value)}
                placeholder="Desde el prototipo hacia el territorio: diseño, implementación y validación…"
                maxLength={300}
              />
            </div>
          )}
        </div>
      )}

      <div className="card filter-card">
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={15} className="search-input-icon" />
            <input
              className="input-field search-input-field"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, folio, correo o institución"
              aria-label="Buscar en la lista"
            />
            {busqueda && (
              <button
                className="btn-limpiar-busqueda"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar la búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="filter-pills">
            {FILTROS.map((f) => (
              <button
                key={f.clave}
                className={`filter-pill${filtro === f.clave ? ' active' : ''}`}
                onClick={() => setFiltro(f.clave)}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-flush">
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">
              Quién tiene derecho a reconocimiento y a quién ya se le mandó
            </caption>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Perfil</th>
                <th>Asistencias</th>
                <th>Reconocimiento</th>
                <th>Enviado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id_participante}>
                  <td className="celda-participante">
                    <div className="participante-nombre">{r.nombre}</div>
                    <div className="participante-correo">{r.correo}</div>
                  </td>
                  <td>
                    <span className="institucion-perfil">{r.perfil}</span>
                  </td>
                  <td className="cifra">
                    {/* A la asamblea no se le cuentan: enseñar un 0 junto a un
                        «Le toca» parece una contradicción. */}
                    {esAsamblea(r)
                      ? '—'
                      : `${numero.format(r.asistencias ?? 0)} · ${numero.format(r.dias_asistidos ?? 0)} día${r.dias_asistidos === 1 ? '' : 's'}`}
                  </td>
                  <td className="celda-accion">
                    {r.reconocimiento_disponible ? (
                      <span className="estado-celda afirmativo">
                        <CheckCircle size={17} /> Le toca
                      </span>
                    ) : (
                      <span className="estado-celda negativo">
                        <XCircle size={17} /> No llega al mínimo
                      </span>
                    )}
                  </td>
                  <td className="celda-accion">
                    {r.fecha_reconocimiento_enviado ? (
                      <span className="estado-celda afirmativo">
                        <Mail size={16} /> {fechaCorta(r.fecha_reconocimiento_enviado)}
                      </span>
                    ) : (
                      <span className="estado-celda negativo">—</span>
                    )}
                  </td>
                  <td className="celda-accion">
                    <button
                      className="btn btn-outline btn-header"
                      onClick={() => verElSuyo(r)}
                      disabled={descargando === r.id_participante}
                      title="Baja su PDF, tal y como lo va a recibir"
                      /* El rótulo va en el atributo y no en un `.sr-only`
                         dentro del botón. `.sr-only` se coloca con
                         `position: absolute`, y como la raíz de la página
                         lleva `transform` —de `.fade-in-up`—, es ella la que
                         hace de bloque contenedor: el elemento se escapaba del
                         `overflow` de `.table-scroll` y se quedaba en su
                         posición estática, a 600 px a la derecha, estirando el
                         documento entero. Lo cazó la prueba de desbordamiento
                         de disposicion.spec.js. */
                      aria-label={`Descargar el reconocimiento de ${r.nombre}`}
                    >
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <EstadoVacio
                      icono={Award}
                      titulo={hayFiltros ? 'Nadie con esos filtros' : 'Todavía no hay padrón'}
                      mensaje={
                        hayFiltros
                          ? 'Prueba con otro filtro o limpia la búsqueda.'
                          : 'Cuando haya registros con asistencias aparecerán aquí.'
                      }
                      accion={
                        hayFiltros
                          ? {
                              texto: 'Ver a todos',
                              onClick: () => {
                                setFiltro('todos');
                                setBusqueda('');
                              },
                            }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={porEnviar !== null}
        title="Mandar los reconocimientos"
        message={
          `Se le va a mandar su reconocimiento por correo a ${numero.format(porEnviar ?? 0)} persona(s), ` +
          'con el PDF adjunto. A quien ya lo recibió no se le repite. Esto no se puede deshacer.'
        }
        confirmText="Mandarlos"
        variant="danger"
        onConfirm={enviarTodo}
        onCancel={() => setPorEnviar(null)}
      />
    </div>
  );
}
