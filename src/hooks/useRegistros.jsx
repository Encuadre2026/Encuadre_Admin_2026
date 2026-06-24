import { useState, useEffect, useCallback, useRef } from 'react';

const API = import.meta.env.VITE_API_URL;

export default function useRegistros() {
  const [data, setData] = useState({ registros: [], cupos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const blobUrlRef = useRef(null);

  const getSecret = () => {
    // Intentar obtener el secret real desde sessionStorage
    const secret = sessionStorage.getItem('ENCUADRE_ADMIN_SECRET');
    if (secret) return secret;

    // Fallback: si no hay secret en sessionStorage, el token ya no es válido
    // (el usuario cerró y reabrió el navegador)
    return null;
  };

  const hasSession = () => {
    return localStorage.getItem('ENCUADRE_ADMIN_TOKEN') && getSecret();
  };

  const fetchRegistros = useCallback(async () => {
    const secret = getSecret();
    if (!secret) { setLoading(false); return false; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/registros`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('ENCUADRE_ADMIN_TOKEN');
        sessionStorage.removeItem('ENCUADRE_ADMIN_SECRET');
        setError('unauthorized');
        return false;
      }
      if (!res.ok) throw new Error('Error al cargar los datos');
      const json = await res.json();
      setData(json);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAprobarPago = useCallback(async (id_participante) => {
    const secret = getSecret();
    if (!secret) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
    const res = await fetch(`${API}/api/admin/aprobar_pago`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_participante }),
    });
    if (!res.ok) throw new Error('Error al aprobar pago');
    await fetchRegistros();
    return { success: true };
  }, [fetchRegistros]);

  const handleViewPdf = useCallback(async (url_comprobante) => {
    const secret = getSecret();
    if (!secret) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');

    // Liberar blob URL anterior para evitar memory leaks
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    const res = await fetch(`${API}/api/admin/comprobante?file=${encodeURIComponent(url_comprobante)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) throw new Error('No se pudo cargar el PDF');
    const blob = await res.blob();
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

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // Limpiar blob URL al desmontar el componente
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  return { data, loading, error, fetchRegistros, handleAprobarPago, handleViewPdf, revokePdfUrl, exportToExcel };
}
