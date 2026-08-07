/**
 * Skeleton — Componente de carga tipo "contenido fantasma" animado.
 *
 * Props:
 *   variant  — "text" | "circle" | "rect" (default: "text")
 *   width    — Ancho CSS (default: "100%")
 *   height   — Alto CSS (default: "1rem")
 *   count    — Cantidad de líneas a renderizar (solo para variant="text")
 *   className — Clase CSS adicional
 */
export default function Skeleton({ variant = 'text', width, height, count = 1, className = '' }) {
  const baseClass = `skeleton skeleton-${variant} ${className}`.trim();

  if (variant === 'text' && count > 1) {
    return (
      <div className="skeleton-group">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={baseClass}
            style={{
              width: i === count - 1 ? '60%' : (width || '100%'),
              height: height || '0.85rem',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={baseClass}
      style={{
        width: width || (variant === 'circle' ? '40px' : '100%'),
        height: height || (variant === 'circle' ? '40px' : '1rem'),
      }}
    />
  );
}

/** Skeleton card for Dashboard KPIs */
export function KpiSkeleton() {
  return (
    <div className="card kpi-card">
      <Skeleton variant="circle" width="52px" height="52px" />
      <div style={{ flex: 1 }}>
        <Skeleton width="80px" height="0.7rem" />
        <Skeleton width="60px" height="1.5rem" className="skeleton-mt" />
      </div>
    </div>
  );
}

/** Skeleton card for Dashboard charts */
export function ChartSkeleton() {
  return (
    <div className="card">
      <Skeleton width="50%" height="1rem" className="skeleton-mb" />
      <Skeleton variant="rect" width="100%" height="200px" />
    </div>
  );
}

/** Skeleton rows for the Participantes table */
export function TableRowSkeleton({ columns = 8, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="skeleton-row">
          {Array.from({ length: columns }, (_, j) => (
            <td key={j} style={{ padding: '0.75rem' }}>
              <Skeleton
                width={j === 0 ? '16px' : j === 2 ? '100%' : '70%'}
                height="0.8rem"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
