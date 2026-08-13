import { useState, useEffect, useCallback, useRef } from 'react';
import { ErrorApi, obtenerSecreto, olvidarSesion, pedir } from '../api/cliente';

export default function useRegistros() {
  const [data, setData] = useState({ registros: [], cupos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const blobUrlRef = useRef(null);

  const fetchRegistros = useCallback(async () => {
    if (!obtenerSecreto()) {
      olvidarSesion();
      setLoading(false);
      setError('unauthorized');
      return false;
    }

    setLoading(true);
    setError('');
    try {
      setData(await pedir('/api/admin/registros'));
      setLastUpdated(new Date());
      return true;
    } catch (err) {
      // 'unauthorized' es la señal que App.jsx usa para mandar al login; el
      // resto de fallos se enseñan tal como los explicó el servidor.
      setError(err instanceof ErrorApi && err.esNoAutorizado ? 'unauthorized' : err.message);
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

  return { data, loading, error, lastUpdated, fetchRegistros, handleAprobarPago, handleEliminarRegistro, handleViewPdf, revokePdfUrl, exportToExcel };
}
