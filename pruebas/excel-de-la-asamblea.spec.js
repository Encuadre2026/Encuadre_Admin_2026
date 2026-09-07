import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { irA, prepararPanel, ASAMBLEA, REGISTROS, REGISTROS_CON_ASAMBLEA } from './apoyo.js';

/**
 * Lo que lleva dentro el Excel.
 *
 * El formulario de la asamblea hace ocho preguntas que no se le hacen a nadie
 * más, y el export solo llevaba las columnas comunes: se recogían y no había
 * dónde leerlas. Ahora aparecen, pero solo cuando en lo exportado hay algún
 * asambleísta.
 *
 * Estas pruebas abren el archivo descargado en vez de mirar la pantalla porque
 * el fallo de esta función es mudo: si la condición deja de cumplirse, el botón
 * sigue funcionando, la hoja sigue bajando y las respuestas simplemente no
 * están. Nada en el panel lo delata.
 */

const COMUNES = [
  'ID Participante', 'Nombre', 'Correo', 'CURP', 'Teléfono',
  'Institución', 'Perfil', 'Taller', 'Pago Aprobado', 'Asistencia',
];

const DE_LA_ASAMBLEA = [
  'Programa académico', 'Representante', 'Asiste al Encuentro', 'Hotel',
  'Viaja con alumnos', 'Número de alumnos', 'Interés en talleres',
  'Taller de preferencia',
];

/** Pulsa el botón de Excel y devuelve el archivo ya abierto. */
async function descargar(page) {
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Excel/ }).click(),
  ]);
  // `cellStyles` no es adorno: sin él SheetJS ni siquiera lee el bloque <cols>
  // del archivo, y los anchos volverían como `undefined` estén o no puestos.
  const libro = XLSX.read(await readFile(await descarga.path()), { type: 'buffer', cellStyles: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  return {
    archivo: descarga.suggestedFilename(),
    pestaña: libro.SheetNames[0],
    anchos: hoja['!cols'],
    // La fila 1 tal cual, sin pasar por el mapeo a objetos: así se comprueba
    // también que no sobre ninguna columna, no solo que estén las esperadas.
    encabezados: XLSX.utils.sheet_to_json(hoja, { header: 1 })[0],
    filas: XLSX.utils.sheet_to_json(hoja, { defval: '' }),
  };
}

test('el padrón sin asambleístas se exporta con las columnas de siempre', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS });
  await irA(page, 'participantes');

  const { archivo, pestaña, encabezados } = await descargar(page);

  expect(encabezados).toEqual(COMUNES);
  expect(pestaña).toBe('Registros');
  expect(archivo).toMatch(/^Registros_Encuadre_\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test('filtrando a la asamblea, la hoja lleva sus ocho respuestas', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();

  const { archivo, pestaña, encabezados, filas } = await descargar(page);

  // Las ocho están. Y no están las cuatro que en esta hoja no dicen nada: la
  // CURP y el teléfono, que su formulario no pide; el taller, que en todas las
  // filas es el centinela «Sin taller · Asamblea»; y el folio.
  expect(encabezados).toEqual([
    'Nombre', 'Correo', 'Institución', 'Perfil',
    'Pago Aprobado', 'Asistencia', ...DE_LA_ASAMBLEA,
  ]);
  expect(pestaña).toBe('Asamblea');
  expect(archivo).toMatch(/^Asamblea_Encuadre_\d{4}-\d{2}-\d{2}\.xlsx$/);

  // Solo la asamblea, y toda la asamblea.
  expect(filas).toHaveLength(ASAMBLEA.length);

  // Sin folio en esta hoja, el correo es lo que ordena: representante1, 2 y 3.
  const [titular, conCeroAlumnos, queNoAsiste] = filas.sort((a, b) =>
    a.Correo.localeCompare(b.Correo)
  );

  expect(titular).toMatchObject({
    'Programa académico': 'Diseño Gráfico',
    Representante: 'Titular',
    'Asiste al Encuentro': 'Sí',
    Hotel: 'Hotel Francia Aguascalientes',
    'Viaja con alumnos': 'Sí',
    'Número de alumnos': 12,
    'Interés en talleres': 'Sí',
    'Taller de preferencia': 'Futurología aplicada al diseño',
  });

  // Viajar con cero alumnos no es lo mismo que no viajar con alumnos: el cero
  // tiene que sobrevivir a la exportación en vez de leerse como «sin dato».
  expect(conCeroAlumnos['Viaja con alumnos']).toBe('Sí');
  expect(conCeroAlumnos['Número de alumnos']).toBe(0);
  expect(conCeroAlumnos['Interés en talleres']).toBe('No');

  // Y lo que nadie contestó se queda en blanco. Un «No» ahí afirmaría algo que
  // esta persona no dijo: el formulario dejó de preguntárselo.
  expect(queNoAsiste['Asiste al Encuentro']).toBe('No');
  expect(queNoAsiste.Hotel).toBe('');
  expect(queNoAsiste['Viaja con alumnos']).toBe('');
  expect(queNoAsiste['Número de alumnos']).toBe('');
  expect(queNoAsiste['Interés en talleres']).toBe('');
});

test('con la asamblea dentro del padrón entero, nadie pierde columnas', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');

  const { archivo, encabezados, filas } = await descargar(page);

  // Aquí sí hay quien dio CURP y teléfono, así que las columnas se quedan; y
  // el archivo vuelve a llamarse como el padrón, porque eso es lo que es.
  expect(encabezados).toEqual([...COMUNES, ...DE_LA_ASAMBLEA]);
  expect(archivo).toMatch(/^Registros_Encuadre_/);
  expect(filas).toHaveLength(REGISTROS_CON_ASAMBLEA.length);

  // Las ocho respuestas siguen viajando con quien las contestó, y en blanco
  // para el resto del padrón.
  const suyas = filas.find(f => f['ID Participante'] === 'ASA-001');
  expect(suyas.Representante).toBe('Titular');
  const ajenas = filas.find(f => f.Perfil === 'Estudiante');
  expect(ajenas.Representante).toBe('');
  expect(ajenas['Programa académico']).toBe('');
});

test('las columnas bajan a la anchura de lo que llevan', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');

  const { encabezados, anchos } = await descargar(page);
  const anchoDe = (columna) => anchos[encabezados.indexOf(columna)].wch;

  // Un .xlsx no guarda «ajustar al contenido», guarda un número por columna. Sin
  // él Excel pinta las suyas de 8,43 caracteres y «Programa académico» llega
  // recortado a «Programa ac».
  expect(anchos).toHaveLength(encabezados.length);
  expect(Math.min(...anchos.map(c => c.wch))).toBeGreaterThan(9);

  // Manda lo que hay debajo, no el rótulo: «Correo» es corto y sus direcciones
  // largas; «Asistencia» es al revés.
  expect(anchoDe('Correo')).toBeGreaterThan(anchoDe('Asistencia'));

  // Y hay tope: los nombres de taller pasan de cien caracteres, y una columna
  // así de ancha empuja a las demás fuera de la pantalla.
  expect(anchoDe('Taller')).toBe(45);
  expect(Math.max(...anchos.map(c => c.wch))).toBeLessThanOrEqual(45);
});
