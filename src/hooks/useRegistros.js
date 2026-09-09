import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ErrorApi,
  esSoloLectura,
  obtenerSecreto,
  olvidarSesion,
  pedir,
  recordarSoloLectura,
} from '../api/cliente';
import { esAsamblea, siNo } from '../asamblea';

/** Sin dato, celda vacía. */
const texto = (v) => v ?? '';

/**
 * El ancho de cada columna, en caracteres.
 *
 * Un .xlsx no guarda «ajustar al contenido»: guarda un número, y sin él Excel
 * pinta las suyas de 8,43 caracteres. Con eso «Programa académico» llegaba
 * recortado a «Programa ac» y había que ensanchar doce columnas a mano cada vez
 * que se baja la hoja.
 *
 * Se mide el rótulo y lo que hay debajo, y se le suman dos caracteres de aire.
 * El tope de 45 es por los nombres de taller, que pasan de cien caracteres: una
 * columna así de ancha empuja a las demás fuera de la pantalla, y se lee mejor
 * envuelta. El suelo de 10 es por las de «Sí»/«No», donde el rótulo cabe justo
 * y el desplegable del filtro de Excel se le monta encima.
 */
const ANCHO_MINIMO = 10;
const ANCHO_MAXIMO = 45;

function anchosDe(rows) {
  return Object.keys(rows[0]).map((columna) => {
    const largo = rows.reduce(
      (mayor, fila) => Math.max(mayor, String(fila[columna] ?? '').length),
      columna.length
    );
    return { wch: Math.min(ANCHO_MAXIMO, Math.max(ANCHO_MINIMO, largo + 2)) };
  });
}

export default function useRegistros() {
  const [data, setData] = useState({ registros: [], cupos: [] });
  const [loading, setLoading] = useState(true);
  // El error deja de ser una cadena suelta.
  //
  // Valía 'unauthorized' o el mensaje del servidor, y quien lo leía —solo
  // App.jsx— tenía que comparar contra esa cadena mágica. Como objeto, la
  // pantalla puede decidir qué enseñar según el código sin adivinar nada.
  const [error, setError] = useState(null);
  /**
   * Si esta sesión es la del perfil que solo consulta.
   *
   * Arranca con lo apuntado al iniciar sesión para que la primera pintada ya sea
   * la correcta —sin esperar al padrón— y se corrige con lo que responda la API,
   * que es quien decide qué permite cada contraseña.
   */
  const [soloLectura, setSoloLectura] = useState(esSoloLectura);
  const [sinConexion, setSinConexion] = useState(() => !navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState(null);
  const blobUrlRef = useRef(null);

  const fetchRegistros = useCallback(async () => {
    if (!obtenerSecreto()) {
      olvidarSesion();
      setLoading(false);
      setError({ mensaje: 'Tu sesión expiró.', codigo: 'NO_AUTORIZADO', noAutorizado: true });
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const padron = await pedir('/api/admin/registros');
      setData(padron);
      // El perfil viaja en cada respuesta del padrón, no solo en la del login:
      // la contraseña puede rotarse con la sesión abierta, y entonces lo que
      // valía al entrar ya no describe lo que la API permite ahora.
      setSoloLectura(Boolean(padron.solo_lectura));
      recordarSoloLectura(padron.solo_lectura);
      setLastUpdated(new Date());
      setError(null);
      return true;
    } catch (err) {
      // `noAutorizado` es la señal que App.jsx usa para mandar al login; el
      // resto de fallos se enseñan tal como los explicó el servidor, con su
      // código para que la pantalla pueda distinguir sin comparar textos en
      // español.
      const esApi = err instanceof ErrorApi;
      setError({
        mensaje: err.message,
        codigo: esApi ? err.codigo : undefined,
        noAutorizado: esApi && err.esNoAutorizado,
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAprobarPago = useCallback(async (id_participante) => {
    await pedir('/api/admin/aprobar_pago', {
      method: 'POST',
      body: JSON.stringify({ id_participante }),
    });
    await fetchRegistros();
    return { success: true };
  }, [fetchRegistros]);

  const handleEliminarRegistro = useCallback(async (id_participante) => {
    await pedir('/api/admin/registro', {
      method: 'DELETE',
      body: JSON.stringify({ id_participante }),
    });
    await fetchRegistros();
    return { success: true };
  }, [fetchRegistros]);

  const handleViewPdf = useCallback(async (url_comprobante) => {
    // Liberar blob URL anterior para evitar memory leaks
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    // Esta ruta devuelve el PDF en binario; sus errores van en texto plano y el
    // cliente ya se encarga de distinguirlo.
    const blob = await pedir(
      `/api/admin/comprobante?file=${encodeURIComponent(url_comprobante)}`,
      { esperaBinario: true }
    );
    const blobUrl = URL.createObjectURL(blob);
    blobUrlRef.current = blobUrl;
    return blobUrl;
  }, []);

  const revokePdfUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const exportToExcel = useCallback(async (filteredRegistros) => {
    if (!filteredRegistros?.length) return;
    // Importación dinámica para no inflar el bundle
    const XLSX = await import('xlsx');
    // Una columna que nunca dice nada estorba a quien lee la hoja, así que las
    // columnas dependen de a quién se esté exportando. Las ocho del formulario
    // de la asamblea solo aparecen si hay algún asambleísta. Y en una hoja que
    // es SOLO de asamblea se caen cuatro:
    //
    // - la CURP y el teléfono, que su formulario no pide y el Worker guarda
    //   vacíos;
    // - el taller, que en todas sus filas dice «Sin taller · Asamblea», el
    //   centinela que la migración 0005 inventó porque `taller_id` no admite
    //   nulos; el que esta gente sí eligió va en «Taller de preferencia»;
    // - el folio, que en su caso no se usa para nada de lo que se hace con
    //   esta hoja.
    const hayAsamblea = filteredRegistros.some(esAsamblea);
    const soloAsamblea = filteredRegistros.every(esAsamblea);
    const rows = filteredRegistros.map(r => ({
      ...(soloAsamblea ? {} : { 'ID Participante': r.id_participante }),
      Nombre: r.nombre,
      Correo: r.correo,
      ...(soloAsamblea ? {} : { CURP: r.curp, Teléfono: r.telefono }),
      Institución: r.institucion,
      Perfil: r.perfil,
      ...(soloAsamblea ? {} : { Taller: r.taller }),
      'Pago Aprobado': r.pago_aprobado ? 'Sí' : 'No',
      Asistencia: r.asistio ? 'Sí' : 'No',
      ...(hayAsamblea
        ? {
            'Programa académico': texto(r.programa_academico),
            Representante: texto(r.tipo_representante),
            'Asiste al Encuentro': siNo(r.asiste_encuentro),
            Hotel: texto(r.hotel),
            'Viaja con alumnos': siNo(r.viaja_con_alumnos),
            // El número va aparte del sí/no porque «no viaja con alumnos» y
            // «viaja con 0» son respuestas distintas, igual que en la base.
            'Número de alumnos': r.numero_alumnos ?? '',
            'Interés en talleres': siNo(r.interes_talleres),
            // Preferencia, no inscripción: no ocupa cupo ni sustituye al
            // taller de la columna «Taller».
            //
            // Sin taller elegido va un «No», y no la celda en blanco: en una
            // rejilla de cientos de celdas, un hueco no se distingue de un dato
            // que se quedó por el camino. Solo para la asamblea, que es a quien
            // se le preguntó; en el resto del padrón la columna sigue vacía,
            // porque un «No» ahí sería una respuesta que nadie dio.
            'Taller de preferencia': esAsamblea(r) ? texto(r.taller_preferencia) || 'No' : '',
          }
        : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = anchosDe(rows);
    const wb = XLSX.utils.book_new();
    // El nombre y la pestaña dicen qué llevan dentro. Con el nombre único, la
    // hoja del padrón y la de la asamblea se distinguían en la carpeta de
    // descargas solo por el «(1)» que les pone el navegador.
    const que = soloAsamblea ? 'Asamblea' : 'Registros';
    XLSX.utils.book_append_sheet(wb, ws, que);
    XLSX.writeFile(wb, `${que}_Encuadre_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, []);

  // Carga inicial.
  //
  // La regla avisa de que fetchRegistros escribe estado de forma síncrona, lo
  // que en general provoca un render extra. Aquí no: al montar, `loading` ya
  // vale true y `error` ya vale '', que es exactamente lo que les asigna, y
  // React descarta un setState con el mismo valor. Si algún día cambian esos
  // valores iniciales, hay que quitar esta excepción y volver a mirarlo.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // Ida y vuelta de la conexión.
  //
  // `navigator.onLine` no sabe si hay internet: sabe si el sistema cree que hay
  // una red. Con el wifi de un hotel enganchado pero sin salida, dice que sí. Por
  // eso no sustituye al error de la petición —la verdad la trae el fetch que
  // falló—, pero sirve para dos cosas que el error no puede: avisar antes de
  // intentarlo, y volver a cargar solo en cuanto la red regresa, que es
  // exactamente lo que la persona iba a hacer a mano.
  useEffect(() => {
    const alVolver = () => {
      setSinConexion(false);
      fetchRegistros();
    };
    const alCaer = () => setSinConexion(true);

    window.addEventListener('online', alVolver);
    window.addEventListener('offline', alCaer);
    return () => {
      window.removeEventListener('online', alVolver);
      window.removeEventListener('offline', alCaer);
    };
  }, [fetchRegistros]);

  // Auto-refresh cuando la pestaña vuelve a ser visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchRegistros();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchRegistros]);

  // Limpiar blob URL al desmontar el componente
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  return { data, loading, error, sinConexion, lastUpdated, soloLectura, fetchRegistros, handleAprobarPago, handleEliminarRegistro, handleViewPdf, revokePdfUrl, exportToExcel };
}
