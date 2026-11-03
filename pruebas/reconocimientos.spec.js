import { test, expect } from '@playwright/test';
import {
  ESTADO_RECONOCIMIENTOS,
  REGISTROS_CON_ASAMBLEA,
  irA,
  prepararPanel,
} from './apoyo.js';

/**
 * La pantalla desde la que se entregan los reconocimientos.
 *
 * Lo que vigilan estas pruebas, por encima de la disposición: que el panel NO
 * decida quién tiene derecho. Esa regla vive en el Worker, viaja en cada fila
 * (`reconocimiento_disponible`) y aquí solo se pinta. Una prueba que contara
 * asistencias para comprobar el reparto estaría escribiendo la regla por
 * segunda vez, que es justo lo que se quiere evitar.
 */

test.describe('Reconocimientos', () => {
  test('resume cuántos tienen derecho, cuántos salieron y cuántos faltan', async ({ page }) => {
    await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
    await irA(page, 'reconocimientos');

    // 10 del padrón más 2 asambleístas acreditados.
    await expect(page.locator('.kpi-card').filter({ hasText: 'Con derecho' })).toContainText('12');
    await expect(page.locator('.kpi-card').filter({ hasText: 'Ya enviados' })).toContainText('6');
    await expect(page.locator('.kpi-card').filter({ hasText: 'Pendientes' })).toContainText('6');
  });

  test('dice el criterio que aplica la API, sin llevarlo escrito', async ({ page }) => {
    await prepararPanel(page, {
      estadoDeReconocimientos: { ...ESTADO_RECONOCIMIENTOS, minimo_de_asistencias: 4 },
    });
    await irA(page, 'reconocimientos');

    // El número sale del servidor: si la organización lo cambia desde
    // Cloudflare, el panel lo dice sin volver a desplegarse.
    await expect(page.locator('.page-header-contexto')).toContainText('4 asistencias');
  });

  test('arranca enseñando solo a quien le falta recibirlo', async ({ page }) => {
    await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
    await irA(page, 'reconocimientos');

    await expect(page.locator('.filter-pill.active')).toHaveText('Pendientes de envío');

    const filas = page.locator('.data-table tbody tr');
    await expect(filas).toHaveCount(6);
    // Ninguna de las que se ven tiene fecha de envío.
    await expect(filas.first()).toContainText('Le toca');
  });

  test('el filtro de enviados enseña la fecha en que salió', async ({ page }) => {
    await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
    await irA(page, 'reconocimientos');

    await page.getByRole('button', { name: 'Ya enviados' }).click();
    await expect(page.locator('.data-table tbody tr')).toHaveCount(6);
    await expect(page.locator('.data-table tbody tr').first()).toContainText('2 nov');
  });

  test('a la asamblea no le cuenta asistencias', async ({ page }) => {
    await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
    await irA(page, 'reconocimientos');

    await page.getByRole('button', { name: 'Todos' }).click();
    await page.getByLabel('Buscar en la lista').fill('representante1@ejemplo.com');

    const fila = page.locator('.data-table tbody tr').first();
    await expect(fila).toContainText('Asambleísta Encuadre');
    await expect(fila).toContainText('Le toca');
    // Un «0 · 0 días» junto a «Le toca» se lee como una contradicción.
    await expect(fila).not.toContainText('0 días');
  });

  test('descarga el de una persona pidiéndoselo a la API por su folio', async ({ page }) => {
    const { descargas } = await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
    await irA(page, 'reconocimientos');

    const descarga = page.waitForEvent('download');
    await page.locator('.data-table tbody tr').first().getByRole('button').click();
    await descarga;

    expect(descargas).toHaveLength(1);
    expect(descargas[0].get('id')).toBeTruthy();
  });

  test('antes de mandar nada pregunta, y dice a cuánta gente', async ({ page }) => {
    const { enviosDeReconocimientos } = await prepararPanel(page);
    await irA(page, 'reconocimientos');

    await page.getByRole('button', { name: /Enviar a los pendientes/ }).click();

    // La primera llamada es la simulación: cuenta sin mandar.
    await expect(page.locator('.confirm-card')).toBeVisible();
    expect(enviosDeReconocimientos[0]).toEqual({ simulacion: true });
  });

  test('cancelar no manda nada', async ({ page }) => {
    const { enviosDeReconocimientos } = await prepararPanel(page);
    await irA(page, 'reconocimientos');

    await page.getByRole('button', { name: /Enviar a los pendientes/ }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.locator('.confirm-card')).toBeHidden();
    expect(enviosDeReconocimientos.filter((e) => !e.simulacion)).toHaveLength(0);
  });

  test('al confirmar manda en lotes hasta que no queda nadie', async ({ page }) => {
    // Cinco pendientes que la API entrega de dos en dos: el panel tiene que
    // seguir llamando hasta vaciarlos, no quedarse en el primer lote.
    let quedan = 5;
    const { enviosDeReconocimientos } = await prepararPanel(page, {
      alEnviarReconocimientos: (cuerpo) => {
        if (cuerpo.simulacion) return { simulacion: true, enviados: 0, fallidos: 0, pendientes: quedan };
        const enviados = Math.min(2, quedan);
        quedan -= enviados;
        return { enviados, fallidos: 0, detalle_fallidos: [], pendientes: quedan, mensaje: '' };
      },
    });
    await irA(page, 'reconocimientos');

    await page.getByRole('button', { name: /Enviar a los pendientes/ }).click();
    await page.getByRole('button', { name: 'Mandarlos' }).click();

    await expect(page.locator('.toast-success')).toContainText('5');

    // Una simulación más tres lotes: 2, 2 y 1.
    const reales = enviosDeReconocimientos.filter((e) => !e.simulacion);
    expect(reales).toHaveLength(3);
    expect(reales.every((e) => e.limite === 25)).toBe(true);
  });

  test('si un lote no sale, lo dice y no se queda dando vueltas', async ({ page }) => {
    await prepararPanel(page, {
      // Nadie sale y nadie se marca: sin la salida del bucle, el panel llamaría
      // para siempre porque `pendientes` no baja nunca.
      alEnviarReconocimientos: (cuerpo) => ({
        simulacion: Boolean(cuerpo.simulacion),
        enviados: 0,
        fallidos: 3,
        detalle_fallidos: [],
        pendientes: 3,
        mensaje: '',
      }),
    });
    await irA(page, 'reconocimientos');

    await page.getByRole('button', { name: /Enviar a los pendientes/ }).click();
    await page.getByRole('button', { name: 'Mandarlos' }).click();

    await expect(page.locator('.toast-error')).toContainText('3');
  });

  test('genera uno suelto con el nombre que se teclee', async ({ page }) => {
    const { descargas } = await prepararPanel(page);
    await irA(page, 'reconocimientos');

    await page.getByLabel('Plantilla').selectOption('asambleista');
    await page.getByLabel('Nombre, como va a salir impreso').fill('Mtra. Ángeles Núñez');

    const editor = page.locator('.card').filter({ hasText: 'Uno suelto' });
    const descarga = page.waitForEvent('download');
    await editor.getByRole('button', { name: /Descargar/ }).click();
    await descarga;

    expect(descargas).toHaveLength(1);
    expect(descargas[0].get('tipo')).toBe('asambleista');
    expect(descargas[0].get('nombre')).toBe('Mtra. Ángeles Núñez');
  });

  test('el de ponente pide además el título de la ponencia', async ({ page }) => {
    const { descargas } = await prepararPanel(page);
    await irA(page, 'reconocimientos');

    const editor = page.locator('.card').filter({ hasText: 'Uno suelto' });
    const titulo = page.getByLabel('Título de la ponencia, como va a salir impreso');

    // Mientras no sea de ponente, el campo no estorba.
    await expect(titulo).toHaveCount(0);

    await page.getByLabel('Plantilla').selectOption('ponente');
    await page.getByLabel('Nombre, como va a salir impreso').fill('Dra. Ana Victoria de la Rosa');

    // Sin título no se deja descargar: el cartón dice «con la ponencia:» y
    // entregarlo con el hueco en blanco no sirve de nada.
    await expect(editor.getByRole('button', { name: /Descargar/ })).toBeDisabled();

    await titulo.fill('Tipografía y territorio');
    const descarga = page.waitForEvent('download');
    await editor.getByRole('button', { name: /Descargar/ }).click();
    await descarga;

    expect(descargas).toHaveLength(1);
    expect(descargas[0].get('tipo')).toBe('ponente');
    expect(descargas[0].get('ponencia')).toBe('Tipografía y territorio');
  });

  test('a las otras dos plantillas no se les manda ponencia', async ({ page }) => {
    const { descargas } = await prepararPanel(page);
    await irA(page, 'reconocimientos');

    const editor = page.locator('.card').filter({ hasText: 'Uno suelto' });
    await page.getByLabel('Plantilla').selectOption('ponente');
    await page.getByLabel('Nombre, como va a salir impreso').fill('Quien Sea');
    await page.getByLabel('Título de la ponencia, como va a salir impreso').fill('Algo');
    // Y ahora se arrepiente y cambia de plantilla.
    await page.getByLabel('Plantilla').selectOption('participante');

    const descarga = page.waitForEvent('download');
    await editor.getByRole('button', { name: /Descargar/ }).click();
    await descarga;

    expect(descargas[0].get('tipo')).toBe('participante');
    expect(descargas[0].get('ponencia')).toBeNull();
  });

  test('el perfil de consulta no puede mandar ni fabricar ninguno', async ({ page }) => {
    await prepararPanel(page, { soloLectura: true, registros: REGISTROS_CON_ASAMBLEA });
    await irA(page, 'reconocimientos');

    // Mirar sí: la tabla y el recuento siguen ahí.
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar a los pendientes/ })).toHaveCount(0);
    await expect(page.getByLabel('Nombre, como va a salir impreso')).toHaveCount(0);
  });

  test('está en el menú lateral', async ({ page }) => {
    await prepararPanel(page);
    await irA(page, 'dashboard');

    await page.getByRole('button', { name: 'Reconocimientos' }).click();
    await expect(page.locator('h1')).toContainText('Reconocimientos');
  });
});
