import { test, expect } from '@playwright/test';
import { CUPOS, INSTITUCION_SEDE, REGISTROS } from './apoyo.js';

/**
 * El perfil, desde el login de verdad.
 *
 * El resto de las pruebas del panel entran con la sesión ya sembrada en
 * sessionStorage, así que ninguna pasaba por la pantalla de acceso. Y es justo
 * ahí donde se decide el perfil: `comprobarSecreto` lee ahora el cuerpo de la
 * respuesta para saber con cuál de las dos contraseñas se está entrando. Un
 * fallo en esa lectura no lo habría visto nadie.
 */

/** La API, sin sembrar sesión: aquí la sesión la crea el login. */
async function apiQueResponde(page, { soloLectura = false, status = 200 } = {}) {
  await page.route('**/api/admin/**', (ruta) =>
    ruta.fulfill({
      status,
      json:
        status === 200
          ? {
              ok: true,
              registros: REGISTROS,
              cupos: CUPOS,
              institucion_sede: INSTITUCION_SEDE,
              solo_lectura: soloLectura,
            }
          : { ok: false, codigo: 'NO_AUTORIZADO', mensaje: 'No autorizado.' },
    })
  );
}

/**
 * Teclea la contraseña y entra.
 *
 * Espera a la barra lateral, que solo existe una vez dentro. Sin esa espera, lo
 * que viniera después arrancaba mientras el login seguía comprobando la
 * contraseña: la sesión todavía no estaba escrita, el panel se encontraba sin
 * credencial y rebotaba al login, así que la tabla no llegaba nunca. Aislada la
 * prueba pasaba; con la suite entera y la máquina cargada, no.
 */
async function entrarCon(page, contrasena) {
  await page.goto('#/login', { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(contrasena);
  await page.getByRole('button', { name: /Ingresar al panel/ }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
}

test('con la contraseña de administración se entra al panel completo', async ({ page }) => {
  await apiQueResponde(page, { soloLectura: false });
  await entrarCon(page, 'la-de-administracion');

  await page.goto('#/participantes', { waitUntil: 'networkidle' });
  await expect(page.locator('.btn-validar-pago').first()).toBeVisible();
  await expect(page.locator('thead th')).toHaveCount(8);
  await expect(page.locator('.sidebar-perfil')).toHaveCount(0);
});

test('con la contraseña de consulta se entra al panel sin las acciones', async ({ page }) => {
  await apiQueResponde(page, { soloLectura: true });
  await entrarCon(page, 'la-de-consulta');

  // Entra igual: mismo campo, mismo botón, mismo panel.
  await expect(page.locator('.sidebar-perfil')).toHaveText(/Solo consulta/i);

  await page.goto('#/participantes', { waitUntil: 'networkidle' });
  await expect(page.locator('table.data-table')).toBeVisible();
  await expect(page.locator('.btn-validar-pago')).toHaveCount(0);
  await expect(page.locator('thead th')).toHaveCount(7);
});

test('el perfil se sabe desde el login, sin esperar al padrón', async ({ page }) => {
  // Lo que se comprueba aquí es el instante entre entrar y que llegue el
  // padrón. Sin mirarlo, la prueba de arriba pasaría igual aunque el login
  // descartara el perfil: el hook lo corrige medio segundo después, y ese medio
  // segundo es justo el que se quiere evitar.
  //
  // La primera llamada es la del propio login —la que valida la contraseña— y
  // contesta enseguida; la segunda, la del panel ya montado, se queda esperando.
  let contestar;
  const esperada = new Promise((resolver) => { contestar = resolver; });
  let llamadas = 0;
  await page.route('**/api/admin/**', async (ruta) => {
    llamadas += 1;
    if (llamadas > 1) await esperada;
    await ruta.fulfill({
      json: {
        ok: true,
        registros: REGISTROS,
        cupos: CUPOS,
        institucion_sede: INSTITUCION_SEDE,
        solo_lectura: true,
      },
    });
  });

  await entrarCon(page, 'la-de-consulta');

  // El perfil ya está en pantalla mientras el dashboard sigue sin una sola
  // cifra: eso solo puede venir de la respuesta que validó la contraseña.
  await expect(page.locator('.sidebar-perfil')).toHaveText(/Solo consulta/i);
  await expect(page.locator('.kpi-value')).toHaveCount(0);

  // Y al llegar el padrón, el panel se pinta sin cambiar de perfil.
  contestar();
  await expect(page.locator('.kpi-value').first()).toBeVisible();
  await expect(page.locator('.sidebar-perfil')).toBeVisible();
});

test('una contraseña que no vale sigue diciéndolo, y no entra', async ({ page }) => {
  await apiQueResponde(page, { status: 401 });
  // Aquí no se usa `entrarCon`: esa espera a estar dentro, y de eso trata
  // justamente esta prueba —de que no se entre—.
  await page.goto('#/login', { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('ni-la-una-ni-la-otra');
  await page.getByRole('button', { name: /Ingresar al panel/ }).click();

  await expect(page.locator('.acceso-error')).toContainText('Contraseña incorrecta');
  await expect(page.locator('.sidebar')).toHaveCount(0);
});

test('mientras el padrón no llega, no se ofrece nada que validar', async ({ page }) => {
  // Una sesión abierta ANTES de que existiera el segundo perfil: tiene el
  // secreto, pero no la marca que dice con cuál se entró. Hasta que la API
  // conteste, el panel supone que solo consulta; equivocarse hacia ese lado
  // solo retrasa los botones, mientras que al revés se los ofrecería a quien la
  // API va a rechazar.
  await page.addInitScript(() => {
    sessionStorage.setItem('ENCUADRE_ADMIN_SECRET', 'secreto-de-prueba');
    localStorage.setItem('ENCUADRE_ADMIN_TOKEN', 'token-de-prueba');
  });

  let contestar;
  const esperada = new Promise((resolver) => { contestar = resolver; });
  await page.route('**/api/admin/**', async (ruta) => {
    await esperada;
    await ruta.fulfill({
      json: {
        ok: true,
        registros: REGISTROS,
        cupos: CUPOS,
        institucion_sede: INSTITUCION_SEDE,
        solo_lectura: false,
      },
    });
  });

  await page.goto('#/participantes');
  await expect(page.locator('.skeleton-row').first()).toBeVisible();

  // Lo que se mira es la CABECERA, no los botones. Mientras carga no hay filas,
  // así que tampoco habría botones aunque el panel se hubiera creído de
  // administración: afirmar que no hay ninguno pasaría por accidente y no
  // diría nada del valor por defecto. La columna de la flecha sí depende de él.
  await expect(page.locator('thead th')).toHaveCount(7);
  await expect(page.locator('.sidebar-perfil')).toBeVisible();

  // Y en cuanto contesta, el panel se corrige.
  contestar();
  await expect(page.locator('.btn-validar-pago').first()).toBeVisible();
  await expect(page.locator('thead th')).toHaveCount(8);
  await expect(page.locator('.sidebar-perfil')).toHaveCount(0);
});
