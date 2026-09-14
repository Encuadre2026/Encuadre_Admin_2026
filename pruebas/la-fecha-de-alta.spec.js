import { test, expect } from '@playwright/test';
import { irA, prepararPanel, REGISTROS } from './apoyo.js';

/**
 * Que el panel fecha las altas en el día de aquí, no en el de UTC.
 *
 * D1 guarda `fecha_registro` con CURRENT_TIMESTAMP, que escribe
 * «2026-08-12 18:30:00»: son las 12:30 de Aguascalientes, en UTC, con un espacio
 * en medio y sin ninguna marca de zona. Esa cadena no es ISO, así que el
 * navegador la leía con su analizador indulgente y la tomaba por hora local; el
 * tablero, encima, agrupaba por el día en UTC. Los dos errores se sumaban seis
 * horas cada uno, y el resultado era que todo lo registrado a partir del
 * mediodía aparecía fechado al día siguiente: con el padrón al día 14, la
 * gráfica ya estrenaba una columna del 15.
 *
 * La zona se fija en la prueba porque el fallo solo existe en un huso con
 * desfase: corriendo en UTC, el código roto y el arreglado dan lo mismo.
 */
test.use({ timezoneId: 'America/Mexico_City' });

/** Las 12:30 del 12 de agosto en Aguascalientes, tal y como las guarda D1. */
const MEDIODIA_DEL_12 = '2026-08-12 18:30:00';

test('una alta de la tarde no se cuenta en el día siguiente', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page, {
    registros: [{ ...REGISTROS[0], fecha_registro: MEDIODIA_DEL_12 }],
  });
  await irA(page, 'dashboard');
  await page.waitForTimeout(800);

  // Todo el texto del lienzo: las etiquetas del eje de días y, de paso, las
  // cifras del eje vertical, que no estorban a lo que se comprueba.
  const etiquetas = await page.locator('.chart-container-lg text').allTextContents();
  const limpias = etiquetas.map((t) => t.trim());

  expect(limpias, `la gráfica fechó el alta en otro día: ${limpias}`).toContain('12 ago');
  expect(limpias, 'la gráfica inventó un día que no existe en el padrón').not.toContain('13 ago');
});

test('el detalle de la fila dice la hora de aquí, no la de UTC', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page, {
    registros: [{ ...REGISTROS[0], fecha_registro: MEDIODIA_DEL_12 }],
  });
  await irA(page, 'participantes');
  await page.waitForTimeout(400);

  // Desplegar la fila es lo que enseña la fecha de alta.
  await page.locator('tbody tr').first().click();
  await page.waitForTimeout(300);

  const detalle = page.locator('.fila-detalle, tbody').first();
  // 12:30, las de Aguascalientes. Leída en crudo salían las 18:30.
  await expect(detalle).toContainText('12 ago 2026');
  await expect(detalle).toContainText('12:30');
});
