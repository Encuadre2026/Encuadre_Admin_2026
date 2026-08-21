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

test('la cabecera sigue a la vista al bajar por el padrón', async ({ page }) => {
  // A partir de la fila veinte la tabla es una cuadrícula de valores sin
  // rótulo: el «Sí» de la última columna podía ser asistencia o pago, y había
  // que subir a mirar. Se comprueba lo que de verdad importa —que la cabecera
  // siga en pantalla—, no cómo está resuelto.
  const contenedor = page.locator('.table-scroll');
  const cabecera = page.locator('.data-table thead th').first();

  const antes = await cabecera.boundingBox();
  await contenedor.evaluate((el) => el.scrollBy(0, 600));
  await page.waitForTimeout(200);
  const despues = await cabecera.boundingBox();

  expect(
    Math.abs(despues.y - antes.y),
    `la cabecera se fue de ${antes.y} a ${despues.y} al desplazar la tabla`
  ).toBeLessThanOrEqual(2);
  await expect(cabecera).toBeInViewport();
});

test('se puede elegir cuántas filas caben, y la elección sobrevive a la recarga', async ({ page }) => {
  // Eran 25 fijas: en un monitor de escritorio la primera página se quedaba
  // corta, y revisar el padrón entero eran catorce páginas.
  await expect(page.locator('tbody tr.expandable-row')).toHaveCount(25);

  await page.locator('#filas-por-pagina').selectOption('50');
  await expect(page.locator('tbody tr.expandable-row')).toHaveCount(47);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await expect(page.locator('#filas-por-pagina')).toHaveValue('50');
});

test('el estado vacío distingue «no hay nadie» de «los filtros no dejan pasar a nadie»', async ({ page }) => {
  await page.locator('#search-participantes').fill('no-existe-este-participante');
  await page.waitForTimeout(500);

  const vacio = page.locator('.estado-vacio');
  await expect(vacio).toContainText('Ningún registro coincide');

  await vacio.locator('button', { hasText: 'Limpiar filtros' }).click();
  await expect(page.locator('tbody tr.expandable-row')).toHaveCount(25);
  await expect(page.locator('#search-participantes')).toHaveValue('');
});

test('los filtros puestos se ven y se quitan uno a uno', async ({ page }) => {
  // Eran tres controles en tres sitios distintos de la barra, y para volver al
  // padrón entero había que acordarse de cuáles se habían tocado.
  await page.locator('.filter-pill', { hasText: 'Pendientes' }).click();
  await page.locator('.filter-pill', { hasText: 'UAA' }).click();

  const chips = page.locator('.chip-filtro');
  await expect(chips).toHaveCount(2);
  await expect(page.locator('.count-badge')).toContainText(' de 47');

  await chips.filter({ hasText: 'Pago' }).click();
  await expect(chips).toHaveCount(1);
});

test('la tecla / lleva al buscador desde cualquier parte de la página', async ({ page }) => {
  await page.locator('h1').click();
  await page.keyboard.press('/');

  await expect(page.locator('#search-participantes')).toBeFocused();

  // Y no se roba la tecla mientras se escribe: dentro del campo, una barra es
  // una barra.
  await page.keyboard.type('a/b');
  await expect(page.locator('#search-participantes')).toHaveValue('a/b');
});

test('la columna ordenada se anuncia también a un lector de pantalla', async ({ page }) => {
  const cabecera = page.locator('th.sortable', { hasText: 'Participante' });
  await expect(cabecera).toHaveAttribute('aria-sort', 'none');

  await cabecera.click();
  await expect(cabecera).toHaveAttribute('aria-sort', 'ascending');

  await cabecera.click();
  await expect(cabecera).toHaveAttribute('aria-sort', 'descending');
});
