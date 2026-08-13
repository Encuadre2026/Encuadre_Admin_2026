import { createContext, useContext } from 'react';

/**
 * El contexto y su hook viven aparte del proveedor.
 *
 * React Fast Refresh solo puede recargar un módulo en caliente si exporta
 * únicamente componentes. Teniendo aquí el hook, editar el proveedor durante el
 * desarrollo recarga sin perder el estado de la aplicación.
 */
export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
