import { test, expect } from '@playwright/test';
import { irA, prepararPanel } from './apoyo.js';

/**
 * Color y legibilidad de las gráficas.
 *
 * Los mismos cinco colores estaban escritos a mano treinta y una veces en el
 * JSX. `scripts/revisar-color.mjs` vigila que no vuelvan; esto comprueba lo
 * otro: que al pasarlos a tokens los colores sigan siendo los mismos, porque
 * `var()` en un atributo `stroke` o `fill` es de las cosas que fallan en
 * silencio —el trazo se queda vacío y la línea sale negra o no sale— y porque
 * una clase de color mal escrita deja el segmento transparente sin avisar.
 */

const TOKENS = {
  '--color-success': 'rgb(46, 204, 113)',
  '--color-danger': 'rgb(231, 76, 60)',
  '--color-accent-gold': 'rgb(244, 208, 63)',
  '--color-info': 'rgb(52, 152, 219)',
  '--color-accent-purple': 'rgb(142, 68, 173)',
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepararPanel(page);
  await irA(page, 'dashboard');
  await page.waitForTimeout(1800);
});

test('el trazo de la curva resuelve a un color, no se queda en la cadena var()', async ({ page }) => {
  // Es el único sitio donde un token viaja dentro de un atributo SVG, que es
  // donde fallaba antes: recharts lo pasa tal cual y el navegador lo resuelve
  // —o no—, sin decir nada en la consola.
  const trazo = await page
    .locator('.recharts-line .recharts-curve')
    .first()
    .evaluate((linea) => getComputedStyle(linea).stroke);

  expect(trazo, 'un trazo sin resolver deja la curva invisible').toMatch(/^rgb/);
  expect(trazo).toBe(TOKENS['--color-accent-gold']);
});

test('los segmentos de las barras de composición se pintan con su color', async ({ page }) => {
  const rellenos = await page.evaluate(() =>
    [...document.querySelectorAll('.proporcion-segmento')].map((s) => getComputedStyle(s).backgroundColor)
  );

  expect(rellenos.length).toBeGreaterThan(0);
  for (const relleno of rellenos) {
    expect(relleno, 'un segmento sin color es un hueco en la barra').toMatch(/^rgb/);
    expect(relleno).not.toBe('rgba(0, 0, 0, 0)');
    expect(Object.values(TOKENS)).toContain(relleno);
  }
});

test('cada token vale exactamente lo que valía escrito a mano', async ({ page }) => {
  // Si un token se hubiera declarado con otro valor al centralizarlo, el panel
  // seguiría funcionando y nadie lo notaría hasta verlo al lado del anterior.
  const valores = await page.evaluate((nombres) => {
    const raiz = getComputedStyle(document.documentElement);
    const sonda = document.createElement('span');
    document.body.appendChild(sonda);
    const salida = {};
    for (const nombre of nombres) {
      sonda.style.color = raiz.getPropertyValue(nombre).trim();
      salida[nombre] = getComputedStyle(sonda).color;
    }
    sonda.remove();
    return salida;
  }, Object.keys(TOKENS));

  expect(valores).toEqual(TOKENS);
});

test('cada parte de la composición dice cuánto vale', async ({ page }) => {
  // Los donuts que había antes solo mostraban color y nombre: para saber que
  // eran 10 confirmados y 37 pendientes había que pasar el ratón por encima,
  // cosa que en una tableta no ocurre nunca. Las barras que los sustituyen
  // heredan la obligación: la cifra y el porcentaje, escritos.
  const filas = await page.locator('.proporcion-fila').allTextContents();

  expect(filas.length).toBeGreaterThanOrEqual(7);
  for (const texto of filas) {
    expect(texto, `«${texto}» no trae ninguna cifra`).toMatch(/\d+\s*\d+\s*%/);
  }
});

test('las cifras de la composición son las de los datos', async ({ page }) => {
  const filas = await page.locator('.proporcion-fila').allTextContents();
  const pagos = filas.filter((t) => /Confirmados|Pendientes/.test(t));

  // La fixture trae 47 registros con `pago_aprobado` en uno de cada cinco.
  expect(pagos.join(' | ')).toContain('Confirmados10');
  expect(pagos.join(' | ')).toContain('Pendientes37');
});
