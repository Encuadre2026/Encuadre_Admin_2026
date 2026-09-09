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

/**
 * Una fila del padrón.
 *
 * `soloLectura` es el perfil que entra con la segunda contraseña del panel. Para
 * él la fila no se despliega y no hay nada que pulsar salvo los documentos: ni
 * el botón de validar ni el detalle con su «Eliminar registro». La API le niega
 * esas dos rutas de todos modos —responde 403—, así que esconderlas no es la
 * defensa, es no ofrecer lo que va a ser rechazado.
 */
export default function ExpandableRow({ registro: r, soloLectura = false, onAprobarPago, onEliminarRegistro, onViewPdf }) {
  const [expanded, setExpanded] = useState(false);
  // Cuando no se puede desplegar, la fila deja de ser un control: sin `onClick`,
  // sin `tabIndex` y sin `aria-expanded`, porque anunciar que algo se despliega
  // y que no se despliegue es peor que no anunciarlo.
  const desplegable = !soloLectura;

  // Quien representa a una universidad ante la asamblea no paga cuota, así que
  // en su fila no hay nada que validar que sea un pago: lo que la organización
  // revisa y aprueba es el oficio que la acredita. El Worker ya lo trata así
  // —le manda otro correo y responde «Acreditación aprobada»—; lo que faltaba
  // era que el panel lo dijera con las mismas palabras.
  const deLaAsamblea = esAsamblea(r);

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
        className={`expandable-row${expanded ? ' expanded' : ''}${desplegable ? '' : ' sin-desplegar'}`}
        onClick={desplegable ? () => setExpanded(!expanded) : undefined}
        onKeyDown={desplegable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } } : undefined}
        tabIndex={desplegable ? 0 : undefined}
        role="row"
        aria-expanded={desplegable ? expanded : undefined}
      >
        {/* La columna de la flecha desaparece entera en vez de quedarse vacía:
            una columna de 40 px sin nada dentro se lee como un desperfecto. La
            cabecera de la tabla se la salta a la vez. */}
        {desplegable && (
          <td className="celda-desplegar">
            <ChevronRight size={20} className={`expand-icon${expanded ? ' rotated' : ''}`} />
          </td>
        )}
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
                title={deLaAsamblea ? 'Ver el oficio de acreditación' : 'Ver la credencial de estudiante'}
              >
                <FileText size={15} /> {deLaAsamblea ? 'Oficio' : 'Credencial'}
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
          ) : soloLectura ? (
            /* El estado, ya que no la acción: la celda vacía no distinguiría un
               pago pendiente de un dato que no llegó. */
            <span className="estado-celda negativo">
              <XCircle size={17} /> Pendiente
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAprobarPago(r.id_participante, deLaAsamblea); }}
              className="btn btn-validar-pago"
              /* El título solo cuando añade algo: «Validar» a secas no dice qué
                 se valida, mientras que «Validar pago» ya lo lleva escrito y un
                 tooltip que repite el rótulo es ruido. */
              title={deLaAsamblea ? 'Validar la acreditación' : undefined}
            >
              {deLaAsamblea ? 'Validar' : 'Validar pago'}
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
      {desplegable && (
        <tr>
          <td colSpan="8" className="celda-detalle">
            {/* `inert` mientras está cerrado: el detalle sigue en el DOM para
                poder animarlo, y sin esto sus botones —«Eliminar registro» entre
                ellos— seguían en el orden de tabulación de la página, invisibles.
                Con veinticinco filas eran hasta cien paradas a ciegas. */}
            <div className={`row-details${expanded ? ' abierto' : ''}`} inert={!expanded}>
              {/* Este div existe para poder recortar: el alto lo anima la fila de
                  rejilla de arriba, y el relleno tiene que quedar dentro de lo
                  recortado. Puesto en `-inner`, sus 32 px de padding eran el alto
                  mínimo del contenido y cada fila cerrada arrastraba una banda
                  vacía de 33 px. */}
              <div className="row-details-clip">
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
                      <button onClick={() => onAprobarPago(r.id_participante, deLaAsamblea)} className="btn btn-detalle aprobar">
                        <CheckCircle size={14} /> {deLaAsamblea ? 'Aprobar acreditación' : 'Aprobar pago'}
                      </button>
                    )}
                    <button onClick={() => onEliminarRegistro(r.id_participante)} className="btn btn-detalle eliminar">
                      <XCircle size={14} /> Eliminar registro
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
