import { test, expect } from '@playwright/test';
import { irA, prepararPanel } from './apoyo.js';

/**
 * El panel se desplazaba en horizontal —la página entera, no la tabla— en todo
 * ancho por debajo de ~1150 px. En un portátil de 1024 se cortaban la columna
 * de asistencia y parte del botón de exportar; en un móvil, el documento medía
 * más del doble que la pantalla.
 *
 * La causa era una sola declaración ausente, y por eso hace falta esta prueba:
 * es el tipo de fallo que ni el linter ni `vite build` pueden ver, que nadie
 * nota mientras trabaja en un monitor grande, y que vuelve en cuanto alguien
 * añada una columna.
 */

const ANCHOS = [
  { nombre: 'móvil', width: 390, height: 844 },
  { nombre: 'tableta', width: 820, height: 1180 },
  { nombre: 'portátil', width: 1024, height: 768 },
  { nombre: 'escritorio', width: 1440, height: 900 },
];

const RUTAS = ['dashboard', 'participantes', 'cupos'];

for (const ancho of ANCHOS) {
  for (const ruta of RUTAS) {
    test(`${ruta} no desborda en horizontal · ${ancho.nombre} (${ancho.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: ancho.width, height: ancho.height });
      await prepararPanel(page);
      await irA(page, ruta);

      const desbordamiento = await page.evaluate(() => ({
        documento: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
      }));

      expect(
        desbordamiento.documento,
        `el documento mide ${desbordamiento.documento}px en una ventana de ${desbordamiento.ventana}px`
      ).toBeLessThanOrEqual(desbordamiento.ventana);
    });
  }
}

test('la tabla de participantes se desplaza por dentro, no arrastrando la página', async ({ page }) => {
  // La otra manera de dejar verde la prueba anterior sería encoger la tabla
  // hasta perder columnas. Esto afirma que la solución fue la buena: el
  // contenedor con `overflow-x: auto` es el que se desplaza.
  await page.setViewportSize({ width: 1024, height: 768 });
  await prepararPanel(page);
  await irA(page, 'participantes');

  const contenedor = page.locator('.table-scroll');
  const medidas = await contenedor.evaluate((el) => ({
    contenido: el.scrollWidth,
    visible: el.clientWidth,
  }));

  expect(medidas.contenido).toBeGreaterThan(medidas.visible);
  await expect(page.locator('.data-table thead th')).toHaveCount(8);
});

test('el icono de la lupa sigue dentro del campo de búsqueda en móvil', async ({ page }) => {
  // La barra de filtros pasa a columna por debajo de 768 px, y con ella el eje
  // principal pasa a ser el vertical: el `flex-basis` del buscador se
  // interpretaba como altura y su icono, centrado al 50 %, quedaba suelto muy
  // por debajo del campo.
  await page.setViewportSize({ width: 390, height: 844 });
  await prepararPanel(page);
  await irA(page, 'participantes');

  const campo = await page.locator('.search-input-field').boundingBox();
  const lupa = await page.locator('.search-input-icon').boundingBox();

  expect(lupa.y).toBeGreaterThanOrEqual(campo.y - 1);
  expect(lupa.y + lupa.height).toBeLessThanOrEqual(campo.y + campo.height + 1);
});

test('las barras de composición se apilan en móvil en vez de partirse en columnas', async ({ page }) => {
  // Las tres barras de composición son lo único del dashboard que va en
  // rejilla. En 390 px, tres columnas dejan cada una en 110 px: la barra
  // desaparece y los rótulos se parten por la mitad.
  await page.setViewportSize({ width: 390, height: 844 });
  await prepararPanel(page);
  await irA(page, 'dashboard');

  const columnas = await page
    .locator('.composicion-grid')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

  expect(columnas).toBe(1);
});
