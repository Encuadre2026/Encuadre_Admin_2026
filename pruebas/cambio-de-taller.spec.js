import { test, expect } from '@playwright/test';
import { irA, prepararPanel, REGISTROS_CON_ASAMBLEA } from './apoyo.js';

/**
 * Pasar a una persona a otro taller desde su fila del padrón.
 *
 * Lo que se vigila es lo que la coordinación tiene que saber antes de
 * confirmar: a qué taller va, si le quedan lugares en la bolsa que le toca a
 * esa persona y si le va a llegar un correo. Y que el cambio no se pierda en
 * silencio cuando el Worker lo rechaza.
 *
 * Personas de la fixture que se usan aquí:
 * - 220800: de la sede, en «Didácticas…», con el pago aprobado.
 * - ENC-002: de fuera, en «Futurología…», con el pago pendiente.
 * - ENC-004: de la sede, en «Taller de poesía objetual», con el pago pendiente.
 */

async function abrirCambio(page, folio) {
  await page.locator('tbody tr.expandable-row', { hasText: folio }).click();
  const detalle = page.locator('.row-details.abierto');
  await detalle.getByRole('button', { name: 'Cambiar de taller' }).click();
  return page.getByRole('dialog', { name: 'Cambiar de taller' });
}

test('el taller en que ya está no se ofrece, y los lugares son los de su bolsa', async ({ page }) => {
  await prepararPanel(page);
  await irA(page, 'participantes');

  const dialogo = await abrirCambio(page, '220800');
  const selector = dialogo.getByLabel('Taller nuevo');
  await expect(selector).toBeFocused();

  const opciones = await selector.locator('option').allTextContents();
  expect(opciones.some((o) => o.includes('Didácticas'))).toBe(false);
  // Es de la sede: «Futurología» tiene 10 reservados y 4 ocupados.
  expect(opciones).toContain('09. Futurología aplicada al diseño — 6 lugares');
  await expect(dialogo).toContainText('Los lugares son los reservados a UAA');
});

test('quien ya pagó: confirma, manda el folio y el id, y avisa del correo', async ({ page }) => {
  const { cambiosDeTaller } = await prepararPanel(page);
  await irA(page, 'participantes');

  const dialogo = await abrirCambio(page, '220800');
  await expect(dialogo).toContainText('Se le enviará de nuevo el correo de confirmación');
  await dialogo.getByLabel('Taller nuevo').selectOption({ label: '10. Disruptive Design Method — 8 lugares' });
  // El nombre entero, fuera del desplegable que lo recorta.
  await expect(dialogo.locator('.cambio-resumen')).toContainText('Disruptive Design Method');
  await dialogo.getByRole('button', { name: 'Cambiar de taller' }).click();

  await expect(dialogo).toBeHidden();
  expect(cambiosDeTaller).toEqual([
    { metodo: 'PUT', cuerpo: { id_participante: '220800', taller_id: 9 } },
  ]);
  await expect(page.locator('.toast')).toContainText('Se le envió de nuevo la confirmación');
  // El foco vuelve al botón que abrió la ventana.
  await expect(page.locator('.row-details.abierto').getByRole('button', { name: 'Cambiar de taller' })).toBeFocused();
});

test('con el pago pendiente avisa que no sale ningún correo', async ({ page }) => {
  await prepararPanel(page, {
    alCambioDeTaller: () => ({ status: 200, json: { ok: true, correo_enviado: null } }),
  });
  await irA(page, 'participantes');

  const dialogo = await abrirCambio(page, 'ENC-002');
  await expect(dialogo).toContainText('no se le envía ningún correo');
  await dialogo.getByLabel('Taller nuevo').selectOption({ index: 1 });
  await dialogo.getByRole('button', { name: 'Cambiar de taller' }).click();

  await expect(page.locator('.toast')).toContainText('su pago está pendiente');
});

test('un taller sin lugares en su bolsa se ofrece, pero con aviso', async ({ page }) => {
  await prepararPanel(page);
  await irA(page, 'participantes');

  // ENC-004 es de la sede, y la reserva de «Didácticas» está llena (10 de 10).
  const dialogo = await abrirCambio(page, 'ENC-004');
  const selector = dialogo.getByLabel('Taller nuevo');
  const didacticas = (await selector.locator('option').allTextContents()).find((o) => o.includes('Didácticas'));
  expect(didacticas).toMatch(/sin lugares$/);

  await selector.selectOption({ label: didacticas });
  await expect(dialogo.locator('.cambio-aviso')).toContainText('entrará por encima del cupo');
});

test('si el Worker lo rechaza, la ventana sigue abierta con el motivo', async ({ page }) => {
  await prepararPanel(page, {
    alCambioDeTaller: () => ({
      status: 409,
      json: { ok: false, codigo: 'DATOS_INVALIDOS', mensaje: 'El registro cambió mientras tanto. Recarga el panel.' },
    }),
  });
  await irA(page, 'participantes');

  const dialogo = await abrirCambio(page, 'ENC-002');
  await dialogo.getByLabel('Taller nuevo').selectOption({ index: 1 });
  await dialogo.getByRole('button', { name: 'Cambiar de taller' }).click();

  await expect(dialogo.getByRole('alert')).toHaveText('El registro cambió mientras tanto. Recarga el panel.');
  await expect(dialogo.getByRole('button', { name: 'Cambiar de taller' })).toBeEnabled();
});

test('si el correo no salió, el aviso dice que el cambio sí se hizo', async ({ page }) => {
  await prepararPanel(page, {
    alCambioDeTaller: () => ({ status: 200, json: { ok: true, correo_enviado: false } }),
  });
  await irA(page, 'participantes');

  const dialogo = await abrirCambio(page, '220800');
  await dialogo.getByLabel('Taller nuevo').selectOption({ index: 1 });
  await dialogo.getByRole('button', { name: 'Cambiar de taller' }).click();

  await expect(page.locator('.toast')).toContainText('ya está en el taller nuevo, pero el correo de confirmación no salió');
});

test('sin elegir taller no se manda nada', async ({ page }) => {
  const { cambiosDeTaller } = await prepararPanel(page);
  await irA(page, 'participantes');

  const dialogo = await abrirCambio(page, 'ENC-002');
  await dialogo.getByRole('button', { name: 'Cambiar de taller' }).click();

  await expect(dialogo.getByRole('alert')).toHaveText('Elige el taller nuevo.');
  await expect(dialogo.getByLabel('Taller nuevo')).toBeFocused();
  expect(cambiosDeTaller).toHaveLength(0);
});

test('Escape cierra sin cambiar nada y devuelve el foco', async ({ page }) => {
  const { cambiosDeTaller } = await prepararPanel(page);
  await irA(page, 'participantes');

  const dialogo = await abrirCambio(page, 'ENC-002');
  await page.keyboard.press('Escape');

  await expect(dialogo).toBeHidden();
  expect(cambiosDeTaller).toHaveLength(0);
  await expect(page.locator('.row-details.abierto').getByRole('button', { name: 'Cambiar de taller' })).toBeFocused();
});

test('a la asamblea no se le ofrece: no está inscrita en ningún taller', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');

  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();
  await page.locator('tbody tr.expandable-row', { hasText: 'ASA-001' }).click();
  const detalle = page.locator('.row-details.abierto');
  await expect(detalle.getByRole('button', { name: 'Eliminar registro' })).toBeVisible();
  await expect(detalle.getByRole('button', { name: 'Cambiar de taller' })).toHaveCount(0);
});

// Los nombres de taller pasan de cien caracteres y no tienen dónde partirse en
// el desplegable; la ventana no puede empujar la página hacia los lados.
for (const ancho of [240, 320, 390]) {
  test(`a ${ancho}px la ventana cabe sin desplazamiento horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 700 });
    await prepararPanel(page);
    await irA(page, 'participantes');

    const dialogo = await abrirCambio(page, 'ENC-004');
    const selector = dialogo.getByLabel('Taller nuevo');
    const didacticas = (await selector.locator('option').allTextContents()).find((o) => o.includes('Didácticas'));
    await selector.selectOption({ label: didacticas });

    const caja = await dialogo.boundingBox();
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde).toBeLessThanOrEqual(0);
    const selectorCaja = await selector.boundingBox();
    expect(selectorCaja.x + selectorCaja.width).toBeLessThanOrEqual(caja.x + caja.width);
  });
}
