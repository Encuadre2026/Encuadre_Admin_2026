import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Cupos({ registrosHook }) {
  const { data, loading, fetchRegistros } = registrosHook;
  const { showToast } = useToast();

  // Compute per-taller UAA/General counts from registros
  const tallerCounts = useMemo(() => {
    const map = {};
    (data.registros || []).forEach(r => {
      const key = r.taller;
      if (!map[key]) map[key] = { uaa: 0, general: 0 };
      if ((r.institucion || '').includes('UAA')) {
        map[key].uaa++;
      } else {
        map[key].general++;
      }
    });
    return map;
  }, [data.registros]);

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
          <button onClick={onRefresh} className="btn btn-outline" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading && cupos.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      ) : (
        <div className="cupos-grid">
          {cupos.map((c, i) => {
            const counts = tallerCounts[c.nombre] || { uaa: 0, general: 0 };
            const totalInscritos = counts.uaa + counts.general;
            const totalCapacidad = c.cupo_maximo + 7;
            const pctTotal = totalCapacidad ? (totalInscritos / totalCapacidad) * 100 : 0;

            let badgeClass = 'disponible';
            let badgeText = 'Disponible';
            if (totalInscritos >= totalCapacidad) { badgeClass = 'lleno'; badgeText = 'Lleno'; }
            else if (pctTotal >= 80) { badgeClass = 'casi-lleno'; badgeText = 'Casi lleno'; }

            const pctGeneral = c.cupo_maximo ? Math.min(100, (counts.general / c.cupo_maximo) * 100) : 0;
            const pctUAA = Math.min(100, (counts.uaa / 7) * 100);

            return (
              <div key={c.nombre} className="cupo-card fade-in-up" style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="cupo-card-header">
                  <span className="cupo-card-title">{c.nombre}</span>
                  <span className={`cupo-badge ${badgeClass}`}>{badgeText}</span>
                </div>

                <div className="cupo-progress">
                  <div className="cupo-progress-label">
                    <span>General</span>
                    <span>{counts.general} / {c.cupo_maximo}</span>
                  </div>
                  <div className="cupo-progress-bar">
                    <div className="cupo-progress-fill blue" style={{ width: `${pctGeneral}%` }}></div>
                  </div>
                </div>

                <div className="cupo-progress">
                  <div className="cupo-progress-label">
                    <span>UAA</span>
                    <span>{counts.uaa} / 7</span>
                  </div>
                  <div className="cupo-progress-bar">
                    <div className="cupo-progress-fill gold" style={{ width: `${pctUAA}%` }}></div>
                  </div>
                </div>

                <div className="cupo-stats">
                  <div className="cupo-stat">
                    <div className="cupo-stat-value" style={{ color: pctTotal >= 80 ? 'var(--color-accent-gold)' : 'var(--color-text-primary)' }}>
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
