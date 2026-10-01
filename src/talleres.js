/**
 * Lo que el panel necesita saber para editar un taller.
 *
 * Las reglas son las mismas que aplica el Worker en `POST` y `PUT
 * /api/admin/taller`: aquí se repiten para que el formulario avise al escribir,
 * no para decidir. Si el panel dejara pasar algo, el Worker lo rechaza con su
 * propio mensaje y el formulario lo enseña igual.
 */

/** Los cuatro colores del renglón «Imparte» en el formulario de registro. */
export const COLORES_TALLER = [
  { valor: 'verde', nombre: 'Verde' },
  { valor: 'morado', nombre: 'Morado' },
  { valor: 'azul', nombre: 'Azul' },
  { valor: 'rojo', nombre: 'Rojo' },
];

export const LARGO_MAXIMO_NOMBRE = 200;
export const LARGO_MINIMO_NOMBRE = 3;
export const LARGO_MAXIMO_IMPARTE = 200;
export const LARGO_MAXIMO_CURSIVA = 80;
export const MAX_CURSIVAS = 5;
export const MAX_LUGARES_POR_BOLSA = 200;

/**
 * El número con el que se enseña un taller: su id más uno, con dos cifras.
 *
 * Es el mismo que ve la gente en el formulario de registro y el que usan el
 * comité y el PDF de la oferta. Antes esta pantalla numeraba por posición, que
 * coincidía solo mientras no se eliminara ninguno.
 */
export function numeroDeTaller(id) {
  return String(id + 1).padStart(2, '0');
}

/** Un texto como lo guarda el Worker: NFC y con los espacios colapsados. */
export function normalizar(texto) {
  return String(texto ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Sin mayúsculas ni tildes, que es como el Worker decide si un nombre ya existe. */
function claveDeComparacion(nombre) {
  return normalizar(nombre).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Las partes en cursiva, escritas en una sola casilla y separadas por comas.
 *
 * Una casilla de texto y no una lista con botones de «añadir» porque casi
 * ningún taller lleva cursivas, y los que llevan tienen una.
 */
export function cursivasDeTexto(texto) {
  const vistos = [];
  for (const tramo of String(texto ?? '').split(',').map(normalizar)) {
    if (tramo && !vistos.includes(tramo)) vistos.push(tramo);
  }
  return vistos;
}

/**
 * El nombre partido en trozos, cada uno con si va en cursiva o no.
 *
 * Es la misma cuenta que hace el formulario de registro: se marcan las letras
 * de cada tramo sobre el nombre y después se agrupan las seguidas.
 */
export function trozosDelNombre(nombre, cursivas) {
  const enCursiva = new Array(nombre.length).fill(false);
  for (const tramo of cursivas) {
    const inicio = nombre.indexOf(tramo);
    if (inicio !== -1) enCursiva.fill(true, inicio, inicio + tramo.length);
  }
  const trozos = [];
  for (let i = 0; i < nombre.length; ) {
    let fin = i;
    while (fin < nombre.length && enCursiva[fin] === enCursiva[i]) fin++;
    trozos.push({ texto: nombre.slice(i, fin), cursiva: enCursiva[i] });
    i = fin;
  }
  return trozos;
}

/** Un número de lugares tecleado: entero de 0 al techo, o `null`. */
function lugares(texto) {
  const limpio = String(texto ?? '').trim();
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return n <= MAX_LUGARES_POR_BOLSA ? n : null;
}

/**
 * Lo que está mal en el borrador, campo por campo. Vacío si todo está bien.
 *
 * `inscritosGeneral` e `inscritosUaa` son los que ya ocupan cada bolsa: ninguna
 * puede quedar por debajo, porque esas personas ya tienen su lugar. `otros` son
 * los nombres de los demás talleres, para no repetir ninguno.
 */
export function erroresDelTaller(borrador, { inscritosGeneral = 0, inscritosUaa = 0, otros = [], siglasSede = 'UAA' } = {}) {
  const errores = {};

  const nombre = normalizar(borrador.nombre);
  if (nombre.length < LARGO_MINIMO_NOMBRE) {
    errores.nombre = 'Escribe el nombre del taller.';
  } else if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    errores.nombre = `El nombre no puede pasar de ${LARGO_MAXIMO_NOMBRE} caracteres.`;
  } else if (otros.some((otro) => claveDeComparacion(otro) === claveDeComparacion(nombre))) {
    errores.nombre = 'Ya hay un taller con ese nombre.';
  }

  if (normalizar(borrador.imparte).length > LARGO_MAXIMO_IMPARTE) {
    errores.imparte = `No puede pasar de ${LARGO_MAXIMO_IMPARTE} caracteres.`;
  }

  const tramos = cursivasDeTexto(borrador.cursivas);
  const fuera = tramos.find((tramo) => !nombre.includes(tramo));
  if (fuera) {
    errores.cursivas = `«${fuera}» no aparece en el nombre tal como está escrito.`;
  } else if (tramos.length > MAX_CURSIVAS) {
    errores.cursivas = `Como mucho ${MAX_CURSIVAS} partes.`;
  } else if (tramos.some((tramo) => tramo.length > LARGO_MAXIMO_CURSIVA)) {
    errores.cursivas = `Cada parte puede tener hasta ${LARGO_MAXIMO_CURSIVA} caracteres.`;
  }

  const general = lugares(borrador.cupo_maximo);
  const uaa = lugares(borrador.lugares_reservados_uaa);
  if (general === null) {
    errores.cupo_maximo = `Escribe un número entero de 0 a ${MAX_LUGARES_POR_BOLSA}.`;
  } else if (general < inscritosGeneral) {
    errores.cupo_maximo = `Ya hay ${inscritosGeneral} ${inscritosGeneral === 1 ? 'persona inscrita' : 'personas inscritas'} aquí: no puede quedar en menos.`;
  }
  if (uaa === null) {
    errores.lugares_reservados_uaa = `Escribe un número entero de 0 a ${MAX_LUGARES_POR_BOLSA}.`;
  } else if (uaa < inscritosUaa) {
    errores.lugares_reservados_uaa = `Ya hay ${inscritosUaa} ${inscritosUaa === 1 ? 'persona' : 'personas'} de la ${siglasSede} aquí: no puede quedar en menos.`;
  }
  if (general === 0 && uaa === 0) {
    errores.cupo_maximo = 'El taller necesita al menos un lugar.';
  }

  return errores;
}

/** Lo que se manda al Worker, ya limpio. El `id` solo va al editar. */
export function tallerParaEnviar(borrador, id) {
  return {
    ...(id === undefined ? {} : { id }),
    nombre: normalizar(borrador.nombre),
    imparte: normalizar(borrador.imparte),
    color: borrador.color,
    cursivas: cursivasDeTexto(borrador.cursivas),
    cupo_maximo: Number(String(borrador.cupo_maximo).trim()),
    lugares_reservados_uaa: Number(String(borrador.lugares_reservados_uaa).trim()),
  };
}

/**
 * El valor que más se repite en una lista de números, o el de respaldo.
 *
 * Un taller nuevo parte del reparto que tienen casi todos —hoy, 18 y 10—, sin
 * escribir esos números aquí: los declara la API taller por taller.
 */
export function masFrecuente(valores, respaldo) {
  const cuentas = new Map();
  for (const v of valores) {
    if (Number.isInteger(v)) cuentas.set(v, (cuentas.get(v) ?? 0) + 1);
  }
  let mejor = respaldo;
  let veces = 0;
  for (const [v, n] of cuentas) {
    if (n > veces) {
      mejor = v;
      veces = n;
    }
  }
  return mejor;
}
