import { test, expect } from '@playwright/test';
import { irA, prepararPanel, REGISTROS, CUPOS } from './apoyo.js';

/**
 * Lo que el panel dice cuando los datos no llegan.
 *
 * `useRegistros` guardaba el error desde el principio y, salvo el de sesión
 * caducada, nadie lo enseñaba: ante un Worker caído, el panel se quedaba con la
 * tabla vacía y el mensaje «No se encontraron registros». Es decir, afirmaba que
 * no hay nadie inscrito. Quien lo leía no tenía manera de saber que era mentira,
 * y la conclusión razonable —«hoy no se ha registrado nadie»— es justo la
 * equivocada.
 *
 * En Playwright, la ruta registrada más tarde gana, así que romper y reparar la
 * API es cuestión de volver a interceptarla.
 */

const FALLO = {
  ok: false,
  codigo: 'ERROR_SERVIDOR',
  mensaje: 'La base de datos no está disponible.',
};

async function romperApi(page) {
  await page.route('**/api/admin/**', (ruta) => ruta.fulfill({ status: 500, json: FALLO }));
}

async function repararApi(page) {
  await page.route('**/api/admin/**', (ruta) =>
    ruta.fulfill({ json: { ok: true, registros: REGISTROS, cupos: CUPOS } })
  );
}

test('si la primera carga falla, el panel lo dice en vez de fingir que no hay nadie', async ({ page }) => {
  await prepararPanel(page);
  await romperApi(page);
  await irA(page, 'participantes');

  const aviso = page.locator('.aviso-datos');
  await expect(aviso).toContainText('No se pudieron cargar los datos');
  await expect(aviso).toContainText(FALLO.mensaje);

  // Y la tabla no puede seguir diciendo lo de siempre.
  const vacio = page.locator('.estado-vacio');
  await expect(vacio).toContainText('No se pudieron cargar los registros');
  await expect(vacio).not.toContainText('Todavía no hay registros');
});

test('reintentar carga los datos y retira el aviso', async ({ page }) => {
  await prepararPanel(page);
  await romperApi(page);
  await irA(page, 'participantes');
  await expect(page.locator('.aviso-datos')).toBeVisible();

  await repararApi(page);
  await page.locator('.aviso-datos-accion').click();

  await expect(page.locator('tbody tr.expandable-row')).toHaveCount(25);
  await expect(page.locator('.aviso-datos')).toHaveCount(0);
});

test('con datos ya en pantalla, el aviso advierte de que pueden estar desfasados', async ({ page }) => {
  // Es el caso peligroso: la tabla sigue llena y parece al día. Validar un pago
  // contra un padrón de hace media hora es el error que este aviso evita.
  await prepararPanel(page);
  await irA(page, 'participantes');
  await expect(page.locator('tbody tr.expandable-row')).toHaveCount(25);

  await romperApi(page);
  await page.locator('.header-actions button[aria-label="Actualizar datos"]').click();

  const aviso = page.locator('.aviso-datos');
  await expect(aviso).toContainText('No se pudieron actualizar los datos');
  await expect(aviso).toContainText('puede estar desfasado');
  // Los datos viejos siguen ahí: son lo único que hay, y siguen siendo ciertos.
  await expect(page.locator('tbody tr.expandable-row')).toHaveCount(25);
});

test('un fallo de red se explica en castellano, no con «Failed to fetch»', async ({ page }) => {
  // `fetch` solo rechaza cuando la petición no llega a hacerse, y lo que trae
  // entonces es un TypeError en inglés que salía tal cual por pantalla.
  await prepararPanel(page);
  await page.route('**/api/admin/**', (ruta) => ruta.abort('failed'));
  await irA(page, 'dashboard');

  const aviso = page.locator('.aviso-datos');
  await expect(aviso).toContainText('No se pudo contactar con el servidor');
  await expect(aviso).not.toContainText('Failed to fetch');
});

test('sin conexión lo avisa, y al volver la red recarga solo', async ({ page }) => {
  let llamadas = 0;
  await prepararPanel(page);
  await page.route('**/api/admin/registros*', (ruta) => {
    llamadas += 1;
    return ruta.fulfill({ json: { ok: true, registros: REGISTROS, cupos: CUPOS } });
  });
  await irA(page, 'dashboard');

  const antes = llamadas;
  await page.context().setOffline(true);
  await expect(page.locator('.aviso-datos')).toContainText('Sin conexión');

  await page.context().setOffline(false);
  await expect(page.locator('.aviso-datos')).toHaveCount(0);
  // Volver a cargar es lo que la persona iba a hacer a mano en cuanto viera
  // regresar la red.
  await expect.poll(() => llamadas, { timeout: 5000 }).toBeGreaterThan(antes);
});

test('los KPIs no inventan ceros cuando la carga falló', async ({ page }) => {
  // Es la misma mentira que contaba la tabla vacía, en cuatro cifras grandes:
  // «Total registros 0», «0 % del total», «sin pagos pendientes». Un cero es una
  // afirmación sobre el evento, y aquí no se sabe nada del evento.
  await prepararPanel(page);
  await romperApi(page);
  await irA(page, 'dashboard');

  const valores = await page.locator('.kpi-value').allTextContents();
  expect(valores).toEqual(['—', '—', '—', '—']);
  await expect(page.locator('.kpi-sub')).toHaveCount(0);
  await expect(page.locator('.kpi-enlace')).toHaveCount(0);
});

test('el motivo del fallo se dice una vez, no en cada tarjeta', async ({ page }) => {
  // El aviso de arriba lleva la frase del servidor. Repetirla en las seis
  // gráficas serían siete copias del mismo texto en una pantalla.
  await prepararPanel(page);
  await romperApi(page);
  await irA(page, 'dashboard');
  await page.waitForTimeout(800);

  const apariciones = await page.locator(`text=${FALLO.mensaje}`).count();
  expect(apariciones).toBe(1);
});

test('las gráficas sin datos distinguen el fallo de la falta de inscritos', async ({ page }) => {
  await prepararPanel(page);
  await romperApi(page);
  await irA(page, 'dashboard');
  await page.waitForTimeout(800);

  const vacias = page.locator('.estado-vacio');
  await expect(vacias.first()).toContainText('No se pudieron cargar los datos');
  await expect(page.locator('.estado-vacio', { hasText: 'Sin datos todavía' })).toHaveCount(0);
});
