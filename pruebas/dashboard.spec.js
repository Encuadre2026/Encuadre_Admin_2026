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

test('cada barra dice cuántos inscritos tiene', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'dashboard');
  await page.waitForTimeout(1500);

  const cifras = await page.locator('.recharts-label-list text').allTextContents();

  // La fixture trae cinco talleres: cinco barras arriba y tres abajo.
  expect(cifras.length).toBeGreaterThanOrEqual(8);
  expect(cifras.every((t) => /^\d+$/.test(t.trim())), `hay etiquetas que no son cifras: ${cifras}`).toBe(true);
  // Los inscritos del taller más solicitado, según la fixture.
  expect(cifras).toContain('18');
  // Y el que no tiene a nadie. Recharts no dibuja rectángulo para un valor de
  // 0, y sin rectángulo tampoco hay etiqueta: el taller vacío desaparecía de la
  // gráfica que existe justamente para enseñarlo.
  expect(cifras, 'el taller sin inscritos no dice que tiene cero').toContain('0');
});

test('sin registros, cada gráfica lo dice en vez de quedarse en blanco', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page, { registros: [], cupos: [] });
  await irA(page, 'dashboard');
  await page.waitForTimeout(1200);

  // Tres donuts, la curva y las dos de talleres.
  await expect(page.locator('.estado-vacio')).toHaveCount(6);
  await expect(page.locator('.recharts-surface')).toHaveCount(0);
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
