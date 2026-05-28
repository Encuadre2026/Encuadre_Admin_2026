import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

const API = 'https://encuadre-2026-api.sitio-392.workers.dev';

export default function useRegistros() {
  const [data, setData] = useState({ registros: [], cupos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getToken = () => localStorage.getItem('ENCUADRE_ADMIN_TOKEN');

  const fetchRegistros = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return false; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/registros`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('ENCUADRE_ADMIN_TOKEN');
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
    const token = getToken();
    const res = await fetch(`${API}/api/admin/aprobar_pago`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_participante }),
    });
    if (!res.ok) throw new Error('Error al aprobar pago');
    await fetchRegistros();
    return { success: true };
  }, [fetchRegistros]);

  const handleViewPdf = useCallback(async (url_comprobante) => {
    const token = getToken();
    const res = await fetch(`${API}/api/admin/comprobante?file=${encodeURIComponent(url_comprobante)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('No se pudo cargar el PDF');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }, []);

  const handleSetupDB = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API}/api/admin/setup_db`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    await fetchRegistros();
    return json.message || 'Base de datos configurada';
  }, [fetchRegistros]);

  const exportToExcel = useCallback((filteredRegistros) => {
    if (!filteredRegistros?.length) return;
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

  return { data, loading, error, fetchRegistros, handleAprobarPago, handleViewPdf, handleSetupDB, exportToExcel };
}
