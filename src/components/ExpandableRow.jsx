import { useState } from 'react';
import { ChevronRight, FileText, CheckCircle, XCircle } from 'lucide-react';

export default function ExpandableRow({ registro: r, onAprobarPago, onViewPdf }) {
  const [expanded, setExpanded] = useState(false);

  const fechaReg = r.fecha_registro
    ? new Date(r.fecha_registro).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <>
      <tr className={`expandable-row${expanded ? ' expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
        <td style={{ padding: '0.75rem 0.5rem', width: '30px' }}>
          <ChevronRight size={16} className={`expand-icon${expanded ? ' rotated' : ''}`} />
        </td>
        <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--color-accent-gold)', whiteSpace: 'nowrap' }}>
          {r.id_participante}
        </td>
        <td style={{ padding: '0.75rem' }}>
          <div style={{ fontWeight: 500 }}>{r.nombre}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.correo}</div>
        </td>
        <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{r.institucion}</td>
        <td style={{ padding: '0.75rem', fontSize: '0.85rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.taller}>
          {r.taller}
        </td>
        <td style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ padding: '0.2rem 0.5rem', backgroundColor: 'var(--color-bg-hover)', borderRadius: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
              {r.perfil}
            </span>
            {r.url_comprobante && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewPdf(r.url_comprobante); }}
                className="btn btn-outline"
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', borderColor: 'var(--color-accent-gold)', color: 'var(--color-accent-gold)' }}
                title="Ver Credencial"
              >
                <FileText size={11} />
              </button>
            )}
          </div>
        </td>
        <td style={{ padding: '0.75rem' }}>
          {r.pago_aprobado ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2ECC71', fontSize: '0.8rem' }}>
              <CheckCircle size={14} /> Confirmado
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAprobarPago(r.id_participante); }}
              className="btn btn-outline"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
            >
              Validar Pago
            </button>
          )}
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
                    <FileText size={14} /> Ver Comprobante
                  </button>
                )}
                {!r.pago_aprobado && (
                  <button onClick={() => onAprobarPago(r.id_participante)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
                    <CheckCircle size={14} /> Aprobar Pago
                  </button>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
