import { useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle, Ticket, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '../context/toast-contexto';
import { estadoDeCupo } from '../cupos';
import { masFrecuente, numeroDeTaller } from '../talleres';
import EstadoVacio from '../components/EstadoVacio';
import ConfirmDialog from '../components/ConfirmDialog';
import FormularioTaller from '../components/FormularioTaller';

/**
 * Qué significa cada insignia, en una frase.
 *
 * «Solo general» es exacto y no dice nada a quien no tenga presente que un
 * cupo son dos bolsas: lo que hace falta saber es que hoy un estudiante de la
 * UAA no puede inscribirse en ese taller, y eso no cabe en una insignia.
 */
const NOTAS = {
  'Disponible': 'Quedan lugares en las dos bolsas.',
  'Casi lleno': 'Quedan pocos lugares en total.',
  'Solo general': 'La reserva de la UAA está agotada: hoy solo puede inscribirse público general.',
  'Solo UAA': 'La bolsa general está agotada: hoy solo pueden inscribirse personas de la UAA.',
  'Lleno': 'Las dos bolsas están agotadas.',
};

const numero = new Intl.NumberFormat('es-MX');

/** «UAA» de «UAA · Universidad Autónoma de Aguascalientes». */
function siglasDe(institucionSede) {
  return (institucionSede || 'UAA').split('·')[0].trim() || 'UAA';
}

export default function Cupos({ registrosHook }) {
  const { data, loading, error, soloLectura, fetchRegistros, handleGuardarTaller, handleEliminarTaller } =
    registrosHook;
  const { showToast } = useToast();

  // Qué ventana está abierta: el formulario —con el taller que se edita, o
  // `null` para uno nuevo; `undefined` es «cerrado»— o la confirmación de
  // eliminar.
  const [formulario, setFormulario] = useState(undefined);
  const [porEliminar, setPorEliminar] = useState(null);
  // El botón que abrió la ventana, para devolverle el foco al cerrarla. Se
  // guarda al pulsarlo y no se deduce del elemento enfocado: Safari no enfoca
  // un botón al hacer clic con el ratón, y el foco acababa al principio de la
  // página.
  const [disparador, setDisparador] = useState(null);
  const abrirFormulario = (taller) => (e) => {
    setDisparador(e.currentTarget);
    setFormulario(taller);
  };
  const pedirEliminar = (taller) => (e) => {
    setDisparador(e.currentTarget);
    setPorEliminar(taller);
  };
  const [eliminando, setEliminando] = useState(false);

  // El reparto entre UAA y general lo calcula la API con la misma regla que
  // aplica el alta. Aquí se recalculaba desde `registros` usando
  // `institucion.includes('UAA')`, mientras el Worker compara el nombre
  // completo: dos definiciones distintas de quién ocupa un lugar reservado, que
  // solo coincidían porque hoy hay una única institución con «UAA» en el
  // nombre. El panel muestra; no decide.

  const onRefresh = async () => {
    const ok = await fetchRegistros();
    if (ok) showToast('Cupos actualizados', 'info');
  };

  const cupos = data.cupos || [];
  const siglasSede = siglasDe(data.institucion_sede);
  const totales = cupos.reduce(
    (suma, c) => {
      const estado = estadoDeCupo(c);
      return {
        inscritos: suma.inscritos + estado.inscritos,
        capacidad: suma.capacidad + estado.capacidad,
        conBolsaAgotada: suma.conBolsaAgotada + (estado.generalLleno || estado.uaaLleno ? 1 : 0),
        vacios: suma.vacios + (estado.inscritos === 0 ? 1 : 0),
      };
    },
    { inscritos: 0, capacidad: 0, conBolsaAgotada: 0, vacios: 0 }
  );

  // Con la API anterior a los talleres editables no llegaba el id: la fila se
  // numera por posición, como antes, y no se ofrece editar.
  const editables = !soloLectura && cupos.every((c) => Number.isInteger(c.id));
  const idSiguiente = cupos.reduce((mayor, c) => Math.max(mayor, c.id ?? -1), -1) + 1;
  const reparto = {
    general: masFrecuente(cupos.map((c) => c.cupo_maximo), 18),
    uaa: masFrecuente(cupos.map((c) => c.lugares_reservados_uaa), 10),
  };

  // Una sesión caducada a mitad de guardar: el cliente ya la olvidó, y pedir el
  // padrón es lo que manda al login. Sin esto el formulario decía «Tu sesión
  // expiró» y se quedaba ahí, con un botón de guardar que ya no podía funcionar.
  const siCaducoLaSesion = (err) => {
    if (err?.esNoAutorizado) fetchRegistros();
  };

  const guardar = async (taller) => {
    // Si falla, lanza y el formulario enseña el motivo sin cerrarse.
    let guardado;
    try {
      guardado = await handleGuardarTaller(taller);
    } catch (err) {
      siCaducoLaSesion(err);
      throw err;
    }
    const nombre = guardado?.nombre ?? taller.nombre;
    showToast(taller.id === undefined ? `Taller «${nombre}» agregado` : `Taller «${nombre}» guardado`, 'success');
    setFormulario(undefined);
  };

  const eliminar = async () => {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      await handleEliminarTaller(porEliminar.id);
      showToast(`Taller «${porEliminar.nombre}» eliminado`, 'success');
      enfocarTitulo.current = true;
    } catch (e) {
      showToast(e.message, 'error');
      siCaducoLaSesion(e);
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  // Después de eliminar, el botón que abrió la confirmación ya no existe —se fue
  // con su fila— y el foco caía al principio del documento: quien usa teclado
  // tenía que recorrer la página otra vez desde arriba. Se lleva al titular. Va
  // en un efecto y no justo después de eliminar porque la ventana tiene que
  // estar cerrada antes, y React cierra la ventana antes de correr esto.
  const tituloRef = useRef(null);
  const enfocarTitulo = useRef(false);
  useEffect(() => {
    if (!porEliminar && enfocarTitulo.current) {
      enfocarTitulo.current = false;
      tituloRef.current?.focus();
    }
  }, [porEliminar]);

  const inscritosDe = (c) => estadoDeCupo(c).inscritos;
  const bloqueado = porEliminar ? inscritosDe(porEliminar) > 0 : false;

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <div className="page-header-titulo">
          <div className="rotulo-seccion">Panel · Talleres</div>
          <h1 ref={tituloRef} tabIndex={-1}>Talleres y cupos</h1>
          <p className="page-header-contexto">
            {cupos.length > 0
              ? `${cupos.length} ${cupos.length === 1 ? 'taller' : 'talleres'} ·${numero.format(totales.inscritos)} de ${numero.format(totales.capacidad)} lugares ocupados · ${totales.conBolsaAgotada} con una bolsa agotada · ${totales.vacios} sin inscritos`
              : 'Cada taller son dos bolsas independientes: la general y la reservada a la UAA.'}
          </p>
        </div>
        <div className="header-actions">
          {editables && (
            <button className="btn btn-primary btn-header" onClick={abrirFormulario(null)}>
              <Plus size={18} aria-hidden="true" /> Agregar taller
            </button>
          )}
          <button onClick={onRefresh} className="btn btn-outline btn-header" disabled={loading} aria-label="Actualizar cupos">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading && cupos.length === 0 ? (
        <div className="cupos-cargando">
          <RefreshCw size={32} className="spin" />
        </div>
      ) : cupos.length === 0 ? (
        // Sin talleres, la rejilla se quedaba en blanco: una página vacía y
        // ninguna explicación, tanto si la API no respondió como si de verdad
        // no hay ninguno configurado.
        <div className="card">
          {error && !error.noAutorizado ? (
            <EstadoVacio
              icono={AlertTriangle}
              titulo="No se pudieron cargar los cupos"
              accion={{ texto: 'Reintentar', onClick: onRefresh }}
            />
          ) : (
            <EstadoVacio
              icono={Ticket}
              titulo="Todavía no hay talleres"
              mensaje={
                soloLectura
                  ? 'En cuanto la coordinación agregue alguno aparecerá aquí.'
                  : 'Agrega el primero y aparecerá en el formulario de registro.'
              }
              accion={
                soloLectura
                  ? { texto: 'Actualizar', onClick: onRefresh }
                  : { texto: 'Agregar taller', onClick: abrirFormulario(null) }
              }
            />
          )}
        </div>
      ) : (
        <div className="cupos-lista">
          {cupos.map((c, i) => {
            const estado = estadoDeCupo(c);

            return (
              <div key={c.id ?? c.nombre} className="cupo-fila fade-in-up" style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="cupo-fila-identidad">
                  <div className="cupo-fila-cabecera">
                    <span className="cupo-indice cifra">
                      {Number.isInteger(c.id) ? numeroDeTaller(c.id) : String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`cupo-badge ${estado.clase}`}>{estado.insignia}</span>
                  </div>
                  <h2 className="cupo-card-title">{c.nombre}</h2>
                  {c.imparte && <p className="cupo-imparte">Imparte: {c.imparte}</p>}
                  <p className="cupo-nota">{NOTAS[estado.insignia]}</p>
                </div>

                <div className="cupo-bolsas">
                  <div className="cupo-progress">
                    <div className={`cupo-progress-label${estado.generalLleno ? ' saturado' : ''}`}>
                      <span>General</span>
                      <span>{estado.inscritosGeneral} / {c.cupo_maximo}{estado.generalLleno ? ' · lleno' : ''}</span>
                    </div>
                    <div className="cupo-progress-bar">
                      <div className="cupo-progress-fill blue" style={{ width: `${estado.porcentajeGeneral}%` }}></div>
                    </div>
                  </div>

                  <div className="cupo-progress">
                    <div className={`cupo-progress-label${estado.uaaLleno ? ' saturado' : ''}`}>
                      <span>UAA</span>
                      <span>{estado.inscritosUaa} / {estado.reservadosUaa}{estado.uaaLleno ? ' · lleno' : ''}</span>
                    </div>
                    <div className="cupo-progress-bar">
                      <div className="cupo-progress-fill gold" style={{ width: `${estado.porcentajeUaa}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="cupo-total">
                  <div className="cupo-total-cifra">
                    <span className={`cupo-stat-value${estado.inscritos === 0 ? ' vacio' : ''}`}>
                      {numero.format(estado.inscritos)}
                    </span>
                    <span className="cupo-total-de">/ {numero.format(estado.capacidad)}</span>
                  </div>
                  <div className="cupo-total-pct">{Math.round(estado.porcentaje)} % ocupado</div>
                </div>

                {/* Con texto y no solo con icono: un lápiz y un bote de basura
                    se entienden, pero «Editar» y «Eliminar» no hay que
                    adivinarlos. El nombre del taller va en aria-label para que
                    el lector de pantalla no diga veinte veces «Editar». */}
                {editables && (
                  <div className="cupo-acciones">
                    <button
                      className="btn btn-outline cupo-accion"
                      onClick={abrirFormulario(c)}
                      aria-label={`Editar el taller ${numeroDeTaller(c.id)}, ${c.nombre}`}
                    >
                      <Pencil size={16} aria-hidden="true" /> Editar
                    </button>
                    <button
                      className="btn btn-outline cupo-accion cupo-accion--eliminar"
                      onClick={pedirEliminar(c)}
                      aria-label={`Eliminar el taller ${numeroDeTaller(c.id)}, ${c.nombre}`}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formulario !== undefined && (
        <FormularioTaller
          taller={formulario}
          idSiguiente={idSiguiente}
          reparto={reparto}
          otros={cupos.filter((c) => c.id !== formulario?.id).map((c) => c.nombre)}
          siglasSede={siglasSede}
          onGuardar={guardar}
          volverA={disparador}
          onCerrar={() => setFormulario(undefined)}
        />
      )}

      {/* Un taller con gente inscrita no se puede eliminar —el Worker lo
          rechazaría—, así que no se pregunta si se quiere: se explica por qué
          no, con un solo botón. */}
      <ConfirmDialog
        open={Boolean(porEliminar)}
        title={bloqueado ? 'Este taller no se puede eliminar' : 'Eliminar taller'}
        message={
          porEliminar &&
          (bloqueado
            ? `«${porEliminar.nombre}» tiene ${inscritosDe(porEliminar)} ${inscritosDe(porEliminar) === 1 ? 'persona inscrita' : 'personas inscritas'}. Solo se puede eliminar un taller sin inscritos.`
            : `¿Eliminar «${porEliminar.nombre}»? Dejará de aparecer en el formulario de registro. No se puede deshacer.`)
        }
        cancelText={bloqueado ? 'Entendido' : 'Cancelar'}
        confirmText="Eliminar taller"
        variant="danger"
        loading={eliminando}
        onConfirm={bloqueado ? undefined : eliminar}
        volverA={disparador}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
