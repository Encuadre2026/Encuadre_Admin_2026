import { test, expect } from '@playwright/test';
import { irA, prepararPanel } from './apoyo.js';

/**
 * Color y legibilidad de las gráficas.
 *
 * Los mismos cinco colores estaban escritos a mano treinta y una veces en el
 * JSX. `scripts/revisar-color.mjs` vigila que no vuelvan; esto comprueba lo
 * otro: que al pasarlos a tokens los colores sigan siendo los mismos, porque
 * `var()` en un atributo `fill` es de las cosas que fallan en silencio —el
 * relleno se queda vacío y la porción sale negra sin que nadie lo note—.
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

test('los rellenos resuelven a un color, no se quedan en la cadena var()', async ({ page }) => {
  const rellenos = await page.evaluate(() =>
    [...document.querySelectorAll('.recharts-pie-sector path')].map((s) => getComputedStyle(s).fill)
  );

  expect(rellenos.length).toBeGreaterThan(0);
  for (const relleno of rellenos) {
    expect(relleno, 'un relleno sin resolver deja la porción en negro').toMatch(/^rgb/);
    expect(relleno).not.toBe('rgb(0, 0, 0)');
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

test('los donuts dicen cuánto vale cada porción', async ({ page }) => {
  // Solo mostraban color y nombre: para saber que eran 10 confirmados y 37
  // pendientes había que pasar el ratón por encima, cosa que en una tableta no
  // ocurre nunca. La cifra estaba en los datos y no se enseñaba.
  const leyendas = await page.locator('.recharts-legend-item').allTextContents();

  expect(leyendas.length).toBeGreaterThanOrEqual(3);
  for (const texto of leyendas) {
    expect(texto, `«${texto}» no trae ninguna cifra`).toMatch(/\d+\s*\d+%/);
  }
});

test('las cifras de la leyenda son las de los datos', async ({ page }) => {
  const leyendas = await page.locator('.recharts-legend-item').allTextContents();
  const pagos = leyendas.filter((t) => /Confirmados|Pendientes/.test(t));

  // La fixture trae 47 registros con `pago_aprobado` en uno de cada cinco.
  expect(pagos.join(' | ')).toContain('Confirmados 10');
  expect(pagos.join(' | ')).toContain('Pendientes 37');
});
