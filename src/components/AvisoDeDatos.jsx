import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';
import { hace } from '../fecha';

/**
 * Lo que el panel dice cuando los datos no llegan.
 *
 * `useRegistros` guardaba el error desde siempre y, salvo el de sesión
 * caducada, nadie lo enseñaba: si el Worker no respondía, el panel se quedaba
 * con la tabla vacía y el mensaje «No se encontraron registros». Es decir, ante
 * un fallo de red el panel afirmaba que no hay nadie inscrito. Quien lo leía no
 * tenía manera de saber que estaba viendo una mentira.
 *
 * Hay dos situaciones distintas y se dicen distinto:
 *
 *   · No hay datos en pantalla — la primera carga falló. Lo importante es que
 *     no se está viendo el padrón, y el botón de reintentar.
 *   · Hay datos, pero son los de antes — una recarga posterior falló. Lo que se
 *     ve sigue siendo cierto, solo que de hace un rato, y eso hay que decirlo:
 *     validar un pago contra un padrón de hace media hora es el error que este
 *     aviso existe para evitar.
 */
export default function AvisoDeDatos({ error, sinConexion, hayDatos, ultimaCarga, cargando, onReintentar }) {
  // La sesión caducada no se avisa aquí: App redirige al login.
  if (error?.noAutorizado) return null;
  if (!error && !sinConexion) return null;

  const esConexion = sinConexion || error?.codigo === 'SIN_CONEXION';
  const Icono = esConexion ? WifiOff : AlertTriangle;

  const titulo = sinConexion
    ? 'Sin conexión'
    : hayDatos
      ? 'No se pudieron actualizar los datos'
      : 'No se pudieron cargar los datos';

  const detalle = sinConexion
    ? 'El panel volverá a cargarlos solo en cuanto la red regrese.'
    : error?.mensaje;

  return (
    <div className={`aviso-datos${esConexion ? ' conexion' : ''}`} role="alert">
      <span className="aviso-datos-icono"><Icono size={18} /></span>
      <div className="aviso-datos-texto">
        <p className="aviso-datos-titulo">{titulo}</p>
        {detalle && <p className="aviso-datos-detalle">{detalle}</p>}
        {hayDatos && ultimaCarga && (
          <p className="aviso-datos-detalle">
            Lo que ves en pantalla se cargó {hace(ultimaCarga)} y puede estar desfasado.
          </p>
        )}
      </div>
      <button
        className="btn btn-outline btn-header aviso-datos-accion"
        onClick={onReintentar}
        disabled={cargando}
      >
        <RefreshCw size={14} className={cargando ? 'spin' : ''} />
        {cargando ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  );
}
