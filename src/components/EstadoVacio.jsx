import { Inbox } from 'lucide-react';

/**
 * Lo que se enseña cuando no hay nada que enseñar.
 *
 * La tabla decía «No se encontraron registros» en los dos casos que puede
 * haber, que no se parecen en nada: uno es que la API no devolvió a nadie —algo
 * que en un panel de inscripciones significa que el evento acaba de abrirse, o
 * que algo va mal— y el otro es que hay trescientos participantes y los filtros
 * puestos no dejan pasar ninguno. El segundo tiene arreglo desde la propia
 * pantalla, y la pantalla no lo ofrecía: había que acordarse de qué tres
 * controles se habían tocado.
 *
 * Props:
 *   icono   — Componente de icono (por defecto, una bandeja vacía).
 *   titulo  — Qué ha pasado, en una línea.
 *   mensaje — Por qué, y qué se puede hacer.
 *   accion  — { texto, onClick } opcional: la salida, si la hay.
 */
export default function EstadoVacio({ icono: Icono = Inbox, titulo, mensaje, accion }) {
  return (
    <div className="estado-vacio">
      <div className="estado-vacio-icono">
        <Icono size={28} />
      </div>
      <p className="estado-vacio-titulo">{titulo}</p>
      {mensaje && <p className="estado-vacio-mensaje">{mensaje}</p>}
      {accion && (
        <button className="btn btn-outline estado-vacio-accion" onClick={accion.onClick}>
          {accion.texto}
        </button>
      )}
    </div>
  );
}
