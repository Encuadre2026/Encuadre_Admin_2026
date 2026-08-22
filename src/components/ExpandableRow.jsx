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
      >
        <td className="celda-desplegar">
          <ChevronRight size={20} className={`expand-icon${expanded ? ' rotated' : ''}`} />
        </td>
        <td className="celda-id">
          {r.id_participante}
        </td>
        <td className="celda-participante">
          <div className="participante-nombre">{r.nombre}</div>
          <div className="participante-correo">{r.correo}</div>
        </td>
        {/* Quién es esta persona, en una sola celda de dos renglones: la
            institución y el perfil decían lo mismo desde dos columnas
            separadas por otras dos. */}
        <td className="celda-institucion" title={r.institucion}>
          <div className="institucion-sigla">{siglaDe(r.institucion)}</div>
          <div className="institucion-perfil">{r.perfil}</div>
        </td>
        <td className="celda-taller" title={r.taller}>
          <span className="recorte-dos-lineas">{r.taller}</span>
        </td>
        {/* Los dos documentos, juntos. Estaban repartidos entre la celda de
            perfil y la de pago, así que la credencial de un estudiante
            aparecía en una columna y su comprobante en otra. */}
        <td className="celda-documentos">
          <div className="celda-documentos-grupo">
            {r.url_comprobante && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewPdf(r.url_comprobante); }}
                className="btn btn-documento credencial"
                title="Ver la credencial de estudiante"
              >
                <FileText size={15} /> Credencial
              </button>
            )}
            {r.url_comprobante_pago && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewPdf(r.url_comprobante_pago); }}
                className="btn btn-documento comprobante"
                title="Ver el comprobante de pago"
              >
                <FileText size={15} /> Comprobante
              </button>
            )}
          </div>
        </td>
        {/* La celda de pago queda para el pago: o el estado, o la acción. */}
        <td className="celda-accion">
          {r.pago_aprobado ? (
            <span className="estado-celda afirmativo">
              <CheckCircle size={17} /> Confirmado
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAprobarPago(r.id_participante); }}
              className="btn btn-validar-pago"
            >
              Validar pago
            </button>
          )}
        </td>
        <td className="celda-accion">
          {r.asistio ? (
            <span className="estado-celda afirmativo">
              <CheckCircle size={17} /> Sí
            </span>
          ) : (
            <span className="estado-celda negativo">
              <XCircle size={17} /> No
            </span>
          )}
        </td>
      </tr>

      {/* Expandable detail */}
      <tr>
        <td colSpan="8" className="celda-detalle">
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
                  <button onClick={() => onViewPdf(r.url_comprobante)} className="btn btn-detalle credencial">
                    <FileText size={14} /> Ver credencial
                  </button>
                )}
                {r.url_comprobante_pago && (
                  <button onClick={() => onViewPdf(r.url_comprobante_pago)} className="btn btn-detalle comprobante">
                    <FileText size={14} /> Ver comprobante
                  </button>
                )}
                {!r.pago_aprobado && (
                  <button onClick={() => onAprobarPago(r.id_participante)} className="btn btn-detalle aprobar">
                    <CheckCircle size={14} /> Aprobar pago
                  </button>
                )}
                <button onClick={() => onEliminarRegistro(r.id_participante)} className="btn btn-detalle eliminar">
                  <XCircle size={14} /> Eliminar registro
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
