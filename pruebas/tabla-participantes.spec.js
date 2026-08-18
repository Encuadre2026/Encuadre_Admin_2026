import { test, expect } from '@playwright/test';
import { irA, prepararPanel } from './apoyo.js';

/**
 * Densidad y jerarquía de la tabla de participantes.
 *
 * El reparto del ancho estaba invertido respecto al uso: la institución se
 * envolvía en tres renglones y el nombre en dos, dejando las filas en 91 px de
 * alto, mientras el taller —lo que se consulta en cada validación— quedaba
 * recortado a 180 px con puntos suspensivos en todos los anchos. Y las acciones
 * eran objetivos de 18 px de alto, por debajo del mínimo de 24 de WCAG 2.2.
 */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'participantes');
});

test('ninguna acción de la tabla queda por debajo del objetivo táctil mínimo', async ({ page }) => {
  // 24×24 px es el mínimo de WCAG 2.2. Se medían 26×18 y 59×18, y el botón de
  // validar pago —la acción más frecuente— 85×20.
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll('tbody button')]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { texto: b.textContent.trim().slice(0, 20), alto: Math.round(r.height) };
      })
      .filter((b) => b.alto < 24)
  );

  expect(pequenos, `hay acciones de menos de 24 px de alto: ${JSON.stringify(pequenos)}`).toEqual([]);
});

test('los dos documentos se distinguen por su nombre, no solo por el color', async ({ page }) => {
  // Eran dos iconos de 11 px sin texto. Quien valida un pago necesita saber cuál
  // de los dos está abriendo antes de abrirlo.
  await expect(page.locator('tbody button', { hasText: 'Credencial' }).first()).toBeVisible();
  await expect(page.locator('tbody button', { hasText: 'Comprobante' }).first()).toBeVisible();
});

test('cada grupo de filtros dice a qué se refiere', async ({ page }) => {
  // Los dos grupos iban seguidos y ambos empezaban por «Todos»: con las dos
  // pastillas activas en amarillo se leían como un solo grupo con dos
  // selecciones a la vez.
  const rotulos = await page.locator('.filter-group-label').allTextContents();
  expect(rotulos).toEqual(['Pago', 'Institución']);
});

test('el taller se lee sin depender del tooltip', async ({ page }) => {
  const celda = page.locator('.celda-taller').first();
  const medidas = await celda.evaluate((el) => ({
    ancho: Math.round(el.getBoundingClientRect().width),
    lineas: Math.round(el.scrollHeight / parseFloat(getComputedStyle(el).lineHeight)),
  }));

  // Antes: 180 px de ancho máximo y una sola línea recortada con elipsis.
  expect(medidas.ancho).toBeGreaterThanOrEqual(200);
  expect(medidas.lineas).toBeGreaterThanOrEqual(2);
});

test('caben bastantes más filas en pantalla', async ({ page }) => {
  const alto = await page
    .locator('tbody tr')
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().height));

  // Se medían 91 px por fila, doce filas de 47 en un monitor de 1440.
  expect(alto).toBeLessThanOrEqual(75);
});

test('la tabla sigue sin arrastrar la página en horizontal', async ({ page }) => {
  // La densidad se ganó ensanchando columnas, así que conviene reafirmar aquí
  // lo que ya vigila disposicion.spec.js: lo que se desplaza es el contenedor
  // de la tabla, nunca el documento.
  const medidas = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
    contenedorDesplaza: (() => {
      const e = document.querySelector('.table-scroll');
      return e.scrollWidth > e.clientWidth;
    })(),
  }));

  expect(medidas.documento).toBeLessThanOrEqual(medidas.ventana);
  expect(medidas.contenedorDesplaza).toBe(true);
});

test('la píldora de pagos pendientes llega ya filtrada', async ({ page }) => {
  // Llevaba a Participantes sin filtrar, así que había que elegir «Pendientes»
  // a mano justo después de pulsar algo que dice «37 pagos pendientes».
  await irA(page, 'dashboard');
  await page.locator('.sidebar-link', { hasText: 'pagos pendientes' }).click();
  await page.waitForTimeout(500);

  const activa = await page
    .locator('.filter-group', { hasText: 'Pago' })
    .locator('.filter-pill.active')
    .textContent();

  expect(activa.trim()).toBe('Pendientes');
});

test('la columna ordenada se anuncia también a un lector de pantalla', async ({ page }) => {
  const cabecera = page.locator('th.sortable', { hasText: 'Participante' });
  await expect(cabecera).toHaveAttribute('aria-sort', 'none');

  await cabecera.click();
  await expect(cabecera).toHaveAttribute('aria-sort', 'ascending');

  await cabecera.click();
  await expect(cabecera).toHaveAttribute('aria-sort', 'descending');
});
