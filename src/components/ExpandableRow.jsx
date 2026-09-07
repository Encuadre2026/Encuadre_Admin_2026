import { useState } from 'react';
import { ChevronRight, FileText, CheckCircle, XCircle } from 'lucide-react';
import { esAsamblea, siNo } from '../asamblea';

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

  // Qué se enseña al desplegar la fila.
  //
  // Los campos eran seis, fijos, y se pintaban aunque no tuvieran nada dentro:
  // a un asambleísta le salían la CURP y el teléfono en blanco, que su
  // formulario ni siquiera le pide. Un rótulo sin dato debajo no informa de
  // nada; solo obliga a leerlo para descubrir que no dice nada.
  //
  // Y al revés: sus ocho respuestas —las únicas que se le preguntan a él y a
  // nadie más— no aparecían en ninguna pantalla del panel. Ahora esta es la
  // pantalla donde están.
  //
  // El taller se cambia por el de preferencia porque para la asamblea el suyo
  // es «Sin taller · Asamblea», un centinela de la base de datos; y lo que sí
  // dijo esta persona es qué taller le gustaría, que es una preferencia y no
  // una inscripción.
  const detalles = [
    ['CURP', r.curp],
    ['Teléfono', r.telefono],
    ['Correo', r.correo],
    ['Fecha de Registro', fechaReg],
    ['Institución', r.institucion],
    ...(esAsamblea(r)
      ? [
          ['Programa académico', r.programa_academico],
          ['Representante', r.tipo_representante],
          ['Asiste al Encuentro', siNo(r.asiste_encuentro)],
          ['Hotel', r.hotel],
          ['Viaja con alumnos', siNo(r.viaja_con_alumnos)],
          // Va aparte del sí/no: «no viaja con alumnos» y «viaja con 0» son
          // respuestas distintas, igual que en la base.
          ['Número de alumnos', r.numero_alumnos],
          ['Interés en talleres', siNo(r.interes_talleres)],
          ['Taller de preferencia', r.taller_preferencia],
        ]
      : [['Taller', r.taller]]),
  ].filter(([, valor]) => valor !== null && valor !== undefined && valor !== '');

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
          <div className={`row-details${expanded ? ' abierto' : ''}`}>
            <div className="row-details-inner">
              {detalles.map(([rotulo, valor]) => (
                <div className="detail-item" key={rotulo}>
                  <label>{rotulo}</label>
                  <span>{valor}</span>
                </div>
              ))}
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
