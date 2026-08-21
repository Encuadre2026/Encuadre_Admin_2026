import { test, expect } from '@playwright/test';
import { irA, prepararPanel } from './apoyo.js';

/**
 * El sistema visual: la fuente, el contraste, el movimiento y la puerta de
 * entrada.
 *
 * Son cuatro cosas que el linter no puede ver y que fallan en silencio: una
 * fuente que no carga se sustituye por otra sin avisar, un neutro demasiado
 * oscuro sigue siendo texto legible para quien lo eligió, una animación que
 * arranca en `opacity: 0` solo estorba a quien pidió no ver animaciones, y una
 * ruta sin definir contesta con un 404 perfectamente renderizado.
 */

test('el panel se ve con Inter, no con la fuente que toque en cada máquina', async ({ page }) => {
  // `--font-family` pedía 'Inter' desde el primer día y nadie la cargaba: el
  // token estaba bien escrito y no servía de nada. Que el nombre aparezca en la
  // cascada no demuestra nada; lo que se comprueba es que el archivo llegó.
  //
  // Y no vale `document.fonts.check()`: cuando ninguna cara declarada coincide
  // con la familia que se pregunta, no hay nada pendiente de cargar y devuelve
  // `true`. Esta prueba llegó a pasar con el `import` de la fuente borrado. Lo
  // que sí distingue los dos casos es mirar las caras registradas: sin `@font-
  // face` no hay ninguna, y una que existe pero no se ha descargado se queda en
  // `unloaded`.
  await prepararPanel(page);
  await irA(page, 'dashboard');

  const fuente = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      declarada: getComputedStyle(document.body).fontFamily,
      cargadas: [...document.fonts]
        .filter((cara) => cara.family === 'Inter Variable' && cara.status === 'loaded')
        .length,
    };
  });

  expect(fuente.declarada).toContain('Inter Variable');
  expect(fuente.cargadas, 'la fuente se pide pero no llega: el navegador la sustituye').toBeGreaterThan(0);
});

test('el texto apagado alcanza el contraste mínimo sobre las dos superficies', async ({ page }) => {
  // `--color-text-muted` era #666666: 3.4:1, por debajo del 4.5:1 que WCAG pide
  // para texto pequeño. Con él estaban escritos los rótulos de la fila
  // desplegada, los de cada gráfica y la marca de «Actualizado hace un minuto».
  // Una rampa nueva puede volver a caer ahí sin que se note en un monitor bueno.
  await prepararPanel(page);
  await irA(page, 'dashboard');

  const contrastes = await page.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement);
    const sonda = document.createElement('span');
    document.body.appendChild(sonda);

    const aRgb = (valor) => {
      sonda.style.color = valor;
      return getComputedStyle(sonda).color.match(/\d+/g).slice(0, 3).map(Number);
    };

    const luminancia = ([r, g, b]) =>
      [r, g, b]
        .map((c) => c / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((suma, c, i) => suma + c * [0.2126, 0.7152, 0.0722][i], 0);

    const contraste = (frente, fondo) => {
      const [a, b] = [luminancia(aRgb(frente)), luminancia(aRgb(fondo))].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    };

    const token = (nombre) => raiz.getPropertyValue(nombre).trim();
    const salida = {
      apagadoSobreSuperficie: contraste(token('--color-text-muted'), token('--color-bg-surface')),
      apagadoSobreTarjeta: contraste(token('--color-text-muted'), token('--color-bg-card')),
      secundarioSobreSuperficie: contraste(token('--color-text-secondary'), token('--color-bg-surface')),
    };
    sonda.remove();
    return salida;
  });

  expect(contrastes.apagadoSobreSuperficie).toBeGreaterThanOrEqual(4.5);
  expect(contrastes.apagadoSobreTarjeta).toBeGreaterThanOrEqual(4.5);
  expect(contrastes.secundarioSobreSuperficie).toBeGreaterThanOrEqual(4.5);
});

test('con el movimiento reducido, el contenido aparece en vez de animarse', async ({ page }) => {
  // `.fade-in-up` arranca en `opacity: 0`. Para quien tiene desactivado el
  // movimiento en su sistema, eso no es una entrada suave: es media página que
  // tarda medio segundo en existir, en cada navegación.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepararPanel(page);
  await irA(page, 'participantes');

  const medida = await page.locator('.fade-in-up').first().evaluate((el) => {
    const estilo = getComputedStyle(el);
    return { opacidad: Number(estilo.opacity), duracion: estilo.animationDuration };
  });

  expect(medida.opacidad).toBe(1);
  expect(medida.duracion, 'la animación sigue durando lo mismo').not.toBe('0.5s');
});

test('la dirección del panel a secas lleva al dashboard, no al 404', async ({ page }) => {
  // La ruta raíz no estaba definida y caía en el comodín: quien entraba desde
  // un marcador o desde el enlace de producción —sin `#/dashboard`— aterrizaba
  // en «Página no encontrada».
  await prepararPanel(page);
  await irA(page, '');

  await expect(page.locator('h1')).toHaveText('Dashboard');
  expect(page.url()).toContain('#/dashboard');
});

test('los avisos se anuncian a quien no ve la pantalla', async ({ page }) => {
  await prepararPanel(page);
  await irA(page, 'dashboard');
  await page.locator('.btn-header', { hasText: 'Actualizar' }).click();

  const aviso = page.locator('.toast-container');
  await expect(aviso).toHaveAttribute('aria-live', 'polite');
  await expect(aviso).toHaveAttribute('role', 'status');
  await expect(aviso).toContainText('Dashboard actualizado');
});
