import { RefreshCw, AlertTriangle, Ticket } from 'lucide-react';
import { useToast } from '../context/toast-contexto';
import { estadoDeCupo } from '../cupos';
import EstadoVacio from '../components/EstadoVacio';

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

export default function Cupos({ registrosHook }) {
  const { data, loading, error, fetchRegistros } = registrosHook;
  const { showToast } = useToast();

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

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <div className="page-header-titulo">
          <div className="rotulo-seccion">Panel · Cupos</div>
          <h1>Cupos por taller</h1>
          <p className="page-header-contexto">
            {cupos.length > 0
              ? `${numero.format(totales.inscritos)} de ${numero.format(totales.capacidad)} lugares ocupados · ${totales.conBolsaAgotada} con una bolsa agotada · ${totales.vacios} sin inscritos`
              : 'Cada taller son dos bolsas independientes: la general y la reservada a la UAA.'}
          </p>
        </div>
        <div className="header-actions">
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
              titulo="No hay talleres configurados"
              mensaje="Los talleres los declara la API; en cuanto haya alguno aparecerá aquí."
              accion={{ texto: 'Actualizar', onClick: onRefresh }}
            />
          )}
        </div>
      ) : (
        <div className="cupos-lista">
          {cupos.map((c, i) => {
            const estado = estadoDeCupo(c);

            return (
              <div key={c.nombre} className="cupo-fila fade-in-up" style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="cupo-fila-identidad">
                  <div className="cupo-fila-cabecera">
                    <span className="cupo-indice cifra">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`cupo-badge ${estado.clase}`}>{estado.insignia}</span>
                  </div>
                  <h2 className="cupo-card-title">{c.nombre}</h2>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
