import { useState } from 'react';
import { ChevronRight, FileText, CheckCircle, XCircle } from 'lucide-react';

/**
 * Sigla de la institución.
 *
 * Las instituciones vienen como «UAA · Universidad Autónoma de Aguascalientes»,
 * y el nombre completo ocupaba tres renglones en su celda: cada fila medía 91 px
 * de alto por un dato que casi nunca se lee entero, mientras el taller —que sí
 * se consulta en cada validación— quedaba recortado a 180 px. El nombre completo
 * sigue disponible en el `title` y en la fila desplegada.
 */
function siglaDe(institucion) {
  if (!institucion) return '—';
  const [sigla] = institucion.split('·');
  return sigla.trim() || institucion;
}

export default function ExpandableRow({ registro: r, onAprobarPago, onEliminarRegistro, onViewPdf }) {
  const [expanded, setExpanded] = useState(false);

  const fechaReg = r.fecha_registro
    ? new Date(r.fecha_registro).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <>
      <tr
        className={`expandable-row${expanded ? ' expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        tabIndex={0}
        role="row"
        aria-expanded={expanded}
        style={{ cursor: 'pointer' }}
      >
        <td style={{ padding: '0.75rem 0.5rem', width: '30px' }}>
          <ChevronRight size={16} className={`expand-icon${expanded ? ' rotated' : ''}`} />
        </td>
        <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--color-accent-gold)', whiteSpace: 'nowrap' }}>
          {r.id_participante}
        </td>
        <td className="celda-participante">
          <div className="participante-nombre">{r.nombre}</div>
          <div className="participante-correo">{r.correo}</div>
        </td>
        <td className="celda-institucion" title={r.institucion}>{siglaDe(r.institucion)}</td>
        <td className="celda-taller" title={r.taller}>
          <span className="recorte-dos-lineas">{r.taller}</span>
        </td>
        <td style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ padding: '0.2rem 0.5rem', backgroundColor: 'var(--color-bg-hover)', borderRadius: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
              {r.perfil}
            </span>
            {r.url_comprobante && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewPdf(r.url_comprobante); }}
                className="btn btn-documento credencial"
                title="Ver la credencial de estudiante"
              >
                <FileText size={13} /> Credencial
              </button>
            )}
          </div>
        </td>
        <td style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {r.pago_aprobado ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2ECC71', fontSize: '0.8rem' }}>
                <CheckCircle size={14} /> Confirmado
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onAprobarPago(r.id_participante); }}
                className="btn btn-validar-pago"
              >
                Validar pago
              </button>
            )}
            {r.url_comprobante_pago && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewPdf(r.url_comprobante_pago); }}
                className="btn btn-documento comprobante"
                title="Ver el comprobante de pago"
              >
                <FileText size={13} /> Comprobante
              </button>
            )}
          </div>
        </td>
        <td style={{ padding: '0.75rem' }}>
          {r.asistio ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2ECC71', fontSize: '0.8rem' }}>
              <CheckCircle size={14} /> Sí
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              <XCircle size={14} /> No
            </span>
          )}
        </td>
      </tr>

      {/* Expandable detail */}
      <tr>
        <td colSpan="8" style={{ padding: 0, border: 'none' }}>
          <div className="row-details" style={{ maxHeight: expanded ? '300px' : '0' }}>
            <div className="row-details-inner">
              <div className="detail-item">
                <label>CURP</label>
                <span>{r.curp}</span>
              </div>
              <div className="detail-item">
                <label>Teléfono</label>
                <span>{r.telefono}</span>
              </div>
              <div className="detail-item">
                <label>Correo</label>
                <span>{r.correo}</span>
              </div>
              <div className="detail-item">
                <label>Fecha de Registro</label>
                <span>{fechaReg}</span>
              </div>
              <div className="detail-item">
                <label>Institución</label>
                <span>{r.institucion}</span>
              </div>
              <div className="detail-item">
                <label>Taller</label>
                <span>{r.taller}</span>
              </div>
              <div className="detail-actions">
                {r.url_comprobante && (
                  <button onClick={() => onViewPdf(r.url_comprobante)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--color-accent-gold)', color: 'var(--color-accent-gold)' }}>
                    <FileText size={14} /> Ver Credencial
                  </button>
                )}
                {r.url_comprobante_pago && (
                  <button onClick={() => onViewPdf(r.url_comprobante_pago)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: '#3498DB', color: '#3498DB' }}>
                    <FileText size={14} /> Ver Pago
                  </button>
                )}
                {!r.pago_aprobado && (
                  <button onClick={() => onAprobarPago(r.id_participante)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
                    <CheckCircle size={14} /> Aprobar Pago
                  </button>
                )}
                <button onClick={() => onEliminarRegistro(r.id_participante)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: '#e74c3c', color: '#e74c3c' }}>
                  <XCircle size={14} /> Eliminar Registro
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
