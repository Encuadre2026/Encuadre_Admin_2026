import { useState, useEffect, useCallback, useRef } from 'react';
import { ErrorApi, obtenerSecreto, olvidarSesion, pedir } from '../api/cliente';


/**
 * El perfil de quien representa a una universidad ante la asamblea.
 *
 * Se reconoce por el perfil y no por el taller «Sin taller · Asamblea»: el
 * perfil es lo que la persona es, y el taller centinela solo existe porque
 * `registros.taller_id` no admite nulos.
 */
const PERFIL_ASAMBLEA = 'Asambleísta Encuadre';

/**
 * Un sí/no que sabe callarse.
 *
 * Estas respuestas llegan como 1, 0 o null, y null no es «no»: es «esta
 * pregunta no se le hizo a esta persona». Escribir «No» ahí afirmaría algo que
 * nadie contestó, así que la celda se queda vacía.
 */
const siNo = (v) => (v === null || v === undefined ? '' : v ? 'Sí' : 'No');

/** Lo mismo para las respuestas de texto: sin dato, celda vacía. */
const texto = (v) => v ?? '';
export default function useRegistros() {
  const [data, setData] = useState({ registros: [], cupos: [] });
  const [loading, setLoading] = useState(true);
  // El error deja de ser una cadena suelta.
  //
  // Valía 'unauthorized' o el mensaje del servidor, y quien lo leía —solo
  // App.jsx— tenía que comparar contra esa cadena mágica. Como objeto, la
  // pantalla puede decidir qué enseñar según el código sin adivinar nada.
  const [error, setError] = useState(null);
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
      setData(await pedir('/api/admin/registros'));
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
    // Las ocho columnas del formulario de la asamblea solo se añaden si en lo
    // exportado hay algún asambleísta. En el padrón general irían las ocho
    // vacías en todas las filas, y una columna que nunca dice nada estorba a
    // quien lee la hoja.
    const hayAsamblea = filteredRegistros.some(r => r.perfil === PERFIL_ASAMBLEA);
    const rows = filteredRegistros.map(r => ({
      'ID Participante': r.id_participante,
      Nombre: r.nombre,
      Correo: r.correo,
      CURP: r.curp,
      Teléfono: r.telefono,
      Institución: r.institucion,
      Perfil: r.perfil,
      Taller: r.taller,
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
            'Taller de preferencia': texto(r.taller_preferencia),
          }
        : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    XLSX.writeFile(wb, `Registros_Encuadre_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  return { data, loading, error, sinConexion, lastUpdated, fetchRegistros, handleAprobarPago, handleEliminarRegistro, handleViewPdf, revokePdfUrl, exportToExcel };
}
