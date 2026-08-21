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

/**
 * El hueco de una cifra de cabecera mientras carga.
 *
 * Dibujaba un círculo de 52 px porque las tarjetas llevaban un icono de color
 * a la izquierda. Ya no hay icono ni tarjeta: son un rótulo y una cifra, y eso
 * es lo que hay que prometer mientras llegan los datos.
 */
export function KpiSkeleton() {
  return (
    <div className="kpi-card">
      <Skeleton width="90px" height="0.7rem" />
      <Skeleton width="70px" height="2.25rem" />
    </div>
  );
}

/** El hueco de una barra de proporción con su leyenda. */
export function ChartSkeleton() {
  return (
    <div className="proporcion">
      <Skeleton width="45%" height="0.7rem" />
      <Skeleton variant="rect" width="100%" height="10px" />
      <Skeleton width="100%" height="0.8rem" count={2} />
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
            // El relleno lo pone `.skeleton-row td`, que ya existía en el CSS y
            // decía exactamente lo mismo que este `style`.
            <td key={j}>
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
