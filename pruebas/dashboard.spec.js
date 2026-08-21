import { test, expect } from '@playwright/test';
import { irA, prepararPanel } from './apoyo.js';

/**
 * Lo que el dashboard enseña y lo que se puede hacer desde él.
 *
 * Las leyendas de los donuts ya dicen sus cifras; las barras no las decían, así
 * que para saber cuántos inscritos tiene un taller había que estimar la longitud
 * de la barra contra el eje o pasar el ratón por encima —cosa que en una tableta
 * no ocurre nunca—. Y sin datos, recharts no falla: pinta un lienzo vacío, que
 * se ve exactamente igual que una gráfica rota.
 */

test('cada taller dice cuántos inscritos tiene, y contra cuántos lugares', async ({ page }) => {
  // Eran dos gráficas de barras —«Top 5» y «Top 3 menos solicitados»— que con
  // cinco talleres enseñaban tres de ellos dos veces. Ahora es una sola lista
  // ordenada por demanda; lo que sigue importando es lo mismo: que la cifra
  // esté escrita y no haya que estimarla mirando la longitud de la barra.
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'dashboard');
  await page.waitForTimeout(800);

  const cifras = await page.locator('.taller-cifra').allTextContents();

  // La fixture trae cinco talleres, y cada uno aparece una sola vez.
  expect(cifras).toHaveLength(5);
  expect(
    cifras.every((t) => /^\d+ \/ \d+$/.test(t.trim())),
    `hay filas que no dicen su cifra: ${cifras}`
  ).toBe(true);
  // Los inscritos del taller más solicitado, según la fixture, y su capacidad.
  expect(cifras.map((t) => t.trim())).toContain('18 / 28');
  // Y el que no tiene a nadie. Una barra de longitud cero no se dibuja, así que
  // el taller vacío desaparecía de la gráfica que existe justamente para
  // enseñarlo: la fila lo dice con todas las letras.
  expect(cifras.map((t) => t.trim()), 'el taller sin inscritos no dice que tiene cero').toContain('0 / 28');
  await expect(page.locator('.taller-insignia', { hasText: 'Sin inscritos' })).toHaveCount(1);
});

test('sin registros, cada gráfica lo dice en vez de quedarse en blanco', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page, { registros: [], cupos: [] });
  await irA(page, 'dashboard');
  await page.waitForTimeout(1200);

  // La curva, la lista de talleres y las tres barras de composición.
  await expect(page.locator('.estado-vacio')).toHaveCount(5);
  await expect(page.locator('.recharts-surface')).toHaveCount(0);
  await expect(page.locator('.proporcion-barra')).toHaveCount(0);
});

test('la cifra de pagos pendientes lleva a validarlos', async ({ page }) => {
  // Lo que se hace después de leer «37 pendientes» es ir a validarlos, y eso
  // eran tres clics: la barra lateral, la tabla y el filtro.
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'dashboard');

  await page.locator('.kpi-enlace').click();
  await page.waitForTimeout(500);

  expect(page.url()).toContain('#/participantes');
  const activa = await page
    .locator('.filter-group', { hasText: 'Pago' })
    .locator('.filter-pill.active')
    .textContent();
  expect(activa.trim()).toBe('Pendientes');
});
