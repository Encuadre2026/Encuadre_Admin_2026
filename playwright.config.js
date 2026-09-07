import { defineConfig, devices } from '@playwright/test';

/**
 * Casi todas son pruebas de disposición: el panel no tiene suite de
 * integración y añadirla no era el objetivo. Lo que hacía falta era una red
 * que atrapase las regresiones que ni el linter ni `vite build` pueden ver,
 * porque no son errores de código sino de ancho.
 *
 * La excepción es `excel-de-la-asamblea.spec.js`, que abre el archivo
 * descargado. Está aquí por el mismo motivo, porque ese fallo tampoco
 * se ve: la hoja baja igual, solo que sin las columnas.
 */
export default defineConfig({
  testDir: './pruebas',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://127.0.0.1:4173/Encuadre_Admin_2026/',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // Se compila siempre: reutilizar un servidor ya levantado permitiría que la
    // prueba validase un build viejo y diese verde sobre código que no es el
    // que se va a desplegar.
    // `--host 127.0.0.1` no es adorno: sin él `vite preview` escucha solo en
    // ::1 y en Windows la comprobación de arranque por IPv4 se queda colgada
    // hasta agotar el tiempo.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/Encuadre_Admin_2026/',
    reuseExistingServer: false,
    timeout: 120_000,
    // Una URL inventada, para que quede claro que ninguna prueba habla con el
    // Worker real: las llamadas se interceptan antes de salir.
    env: { VITE_API_URL: 'https://api-de-prueba.invalido' },
  },
});
