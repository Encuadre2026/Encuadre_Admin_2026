import { RefreshCw, AlertTriangle, Ticket } from 'lucide-react';
import { useToast } from '../context/toast-contexto';
import EstadoVacio from '../components/EstadoVacio';

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

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <h1>Cupos por Taller</h1>
        <div className="header-actions">
          <button onClick={onRefresh} className="btn btn-outline btn-header" disabled={loading}>
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
        <div className="cupos-grid">
          {cupos.map((c, i) => {
            const reservadosUaa = c.lugares_reservados_uaa ?? 0;
            const inscritosUaa = c.inscritos_uaa ?? 0;
            const inscritosGeneral = c.inscritos_general ?? 0;
            const totalInscritos = c.inscritos ?? inscritosUaa + inscritosGeneral;
            const totalCapacidad = c.cupo_maximo + reservadosUaa;
            const pctTotal = totalCapacidad ? (totalInscritos / totalCapacidad) * 100 : 0;

            // Un cupo son dos bolsas independientes: la general y la reservada
            // a la UAA. La insignia miraba solo el total, así que un taller con
            // la reserva UAA agotada y hueco general se anunciaba en verde como
            // «Disponible» — y ningún estudiante de la UAA podía inscribirse en
            // él. El panel decía que sí donde el alta decía que no.
            const generalLleno = inscritosGeneral >= c.cupo_maximo;
            const uaaLleno = reservadosUaa > 0 && inscritosUaa >= reservadosUaa;

            let badgeClass = 'disponible';
            let badgeText = 'Disponible';
            if (generalLleno && uaaLleno) {
              badgeClass = 'lleno';
              badgeText = 'Lleno';
            } else if (uaaLleno) {
              badgeClass = 'casi-lleno';
              badgeText = 'Solo general';
            } else if (generalLleno) {
              badgeClass = 'casi-lleno';
              badgeText = 'Solo UAA';
            } else if (pctTotal >= 80) {
              badgeClass = 'casi-lleno';
              badgeText = 'Casi lleno';
            }

            const pctGeneral = c.cupo_maximo
              ? Math.min(100, (inscritosGeneral / c.cupo_maximo) * 100)
              : 0;
            const pctUAA = reservadosUaa ? Math.min(100, (inscritosUaa / reservadosUaa) * 100) : 0;

            return (
              <div key={c.nombre} className="cupo-card fade-in-up" style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="cupo-card-header">
                  <span className="cupo-card-title">{c.nombre}</span>
                  <span className={`cupo-badge ${badgeClass}`}>{badgeText}</span>
                </div>

                <div className="cupo-progress">
                  <div className={`cupo-progress-label${generalLleno ? ' saturado' : ''}`}>
                    <span>General</span>
                    <span>{inscritosGeneral} / {c.cupo_maximo}{generalLleno ? ' · lleno' : ''}</span>
                  </div>
                  <div className="cupo-progress-bar">
                    <div className="cupo-progress-fill blue" style={{ width: `${pctGeneral}%` }}></div>
                  </div>
                </div>

                <div className="cupo-progress">
                  <div className={`cupo-progress-label${uaaLleno ? ' saturado' : ''}`}>
                    <span>UAA</span>
                    <span>{inscritosUaa} / {reservadosUaa}{uaaLleno ? ' · lleno' : ''}</span>
                  </div>
                  <div className="cupo-progress-bar">
                    <div className="cupo-progress-fill gold" style={{ width: `${pctUAA}%` }}></div>
                  </div>
                </div>

                <div className="cupo-stats">
                  <div className="cupo-stat">
                    <div className={`cupo-stat-value${pctTotal >= 80 ? ' destacado' : ''}`}>
                      {totalInscritos}
                    </div>
                    <div className="cupo-stat-label">Inscritos</div>
                  </div>
                  <div className="cupo-stat">
                    <div className="cupo-stat-value">{totalCapacidad}</div>
                    <div className="cupo-stat-label">Capacidad</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
