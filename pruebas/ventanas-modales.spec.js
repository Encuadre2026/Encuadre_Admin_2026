import { test, expect } from '@playwright/test';
import { irA, prepararPanel, REGISTROS } from './apoyo.js';

/**
 * Las dos ventanas del panel —el visor de comprobantes y la confirmación de
 * aprobar o eliminar— se colocaban respecto a la página en vez de respecto a la
 * ventana, y aparecían fuera de la pantalla.
 *
 * La culpa no estaba en su CSS, que es correcto: `.fade-in-up` deja fijo un
 * `transform: translateY(0)` en el contenedor de la página, y un transform
 * distinto de `none` convierte al elemento en el bloque contenedor de sus
 * descendientes `position: fixed`. Como el fallo depende de un estilo lejano
 * que nadie relaciona con el modal, es exactamente el que vuelve solo.
 */

/** Todo lo visible debe caber en la ventana, sin importar el desplazamiento. */
async function cabeEnLaVentana(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    // El overlay es el que lleva `position: fixed`; lo que importa es que
    // ningún antepasado suyo tenga un transform que lo reencuadre, y colgar de
    // <body> es la manera de garantizarlo.
    const overlay = el.closest('.confirm-overlay, .pdf-modal-overlay');
    return {
      dentro: r.top >= -1 && r.bottom <= window.innerHeight + 1,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      alto: Math.round(window.innerHeight),
      montadoEnBody: overlay?.parentElement === document.body,
    };
  });
}

/**
 * Se abre desde la última fila y con la página desplazada al final, que es
 * donde el fallo se manifestaba: cuanto más larga la tabla, más lejos de la
 * pantalla acababa la ventana.
 */
async function abrirDesdeElFinal(page, selectorBoton) {
  await page.mouse.wheel(0, 20_000);
  await page.waitForTimeout(200);
  const botones = page.locator(selectorBoton);
  const ultimo = botones.nth((await botones.count()) - 1);
  await ultimo.scrollIntoViewIfNeeded();
  await ultimo.click();
  await page.waitForTimeout(400);
}

test('la confirmación de aprobar pago aparece dentro de la ventana', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'participantes');
  await abrirDesdeElFinal(page, 'button:has-text("Validar Pago")');

  const medida = await cabeEnLaVentana(page, '.confirm-card');
  expect(medida.montadoEnBody, 'el overlay debe colgar de <body>').toBe(true);
  expect(
    medida.dentro,
    `el cuadro va de ${medida.top} a ${medida.bottom} en una ventana de ${medida.alto}`
  ).toBe(true);
});

test('el visor de comprobantes aparece dentro de la ventana', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'participantes');
  await abrirDesdeElFinal(page, 'button[title="Ver Credencial"]');

  const medida = await cabeEnLaVentana(page, '.pdf-modal-card');
  expect(medida.montadoEnBody, 'el overlay debe colgar de <body>').toBe(true);
  expect(
    medida.dentro,
    `la tarjeta va de ${medida.top} a ${medida.bottom} en una ventana de ${medida.alto}`
  ).toBe(true);
});

test('el visor cabe también en una ventana baja', async ({ page }) => {
  // 1024×640 es un portátil corriente, y donde `80vh` más apretaba.
  await page.setViewportSize({ width: 1024, height: 640 });
  await prepararPanel(page);
  await irA(page, 'participantes');
  await abrirDesdeElFinal(page, 'button[title="Ver Credencial"]');

  const medida = await cabeEnLaVentana(page, '.pdf-modal-card');
  expect(
    medida.dentro,
    `la tarjeta va de ${medida.top} a ${medida.bottom} en una ventana de ${medida.alto}`
  ).toBe(true);
});

test('el documento se pide encajado a la página, no ajustado al ancho', async ({ page }) => {
  // El visor del navegador recuerda el zoom entre documentos y ajusta al ancho
  // por defecto: un comprobante en vertical dentro de un marco apaisado se
  // dibujaba tan grande que solo cabía su mitad superior. `view=Fit` fuerza la
  // página completa cada vez.
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'participantes');
  await abrirDesdeElFinal(page, 'button[title="Ver Credencial"]');

  const src = await page.locator('.pdf-modal-body iframe').getAttribute('src');
  expect(src).toContain('#view=Fit');
});

test('el cuerpo del visor ocupa lo que sobra de la tarjeta', async ({ page }) => {
  // Esta invariante ya se cumplía: el `calc(100% - 56px)` de antes acertaba con
  // el alto de la cabecera. Se afirma porque ese acierto dependía de un número
  // copiado a mano, y ahora que lo reparte el flex conviene dejar constancia de
  // qué es lo que debe seguir siendo cierto.
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page, { registros: REGISTROS.slice(0, 3) });
  await irA(page, 'participantes');
  await abrirDesdeElFinal(page, 'button[title="Ver Credencial"]');

  const encaje = await page.evaluate(() => {
    const tarjeta = document.querySelector('.pdf-modal-card').getBoundingClientRect();
    const cuerpo = document.querySelector('.pdf-modal-body').getBoundingClientRect();
    return { sobresale: Math.round(cuerpo.bottom - tarjeta.bottom), alto: Math.round(cuerpo.height) };
  });

  expect(encaje.alto).toBeGreaterThan(200);
  // El relleno de la tarjeta son 24 px, así que el cuerpo debe acabar antes.
  expect(encaje.sobresale).toBeLessThanOrEqual(0);
});
