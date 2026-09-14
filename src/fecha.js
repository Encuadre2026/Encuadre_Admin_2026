/**
 * Cuánto hace de algo, en palabras.
 *
 * Vivía dentro de `Sidebar.jsx`, que era su único usuario. El aviso de datos sin
 * actualizar necesita decir lo mismo —«lo que ves se cargó hace 12 min»— y dos
 * copias de esto acaban discrepando: una dice «hace 1 h» y la otra «hace 60
 * min» sobre el mismo instante, en la misma pantalla.
 */
export function hace(fecha) {
  if (!fecha) return null;
  const segundos = Math.floor((new Date() - fecha) / 1000);
  if (segundos < 60) return 'hace unos segundos';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `hace ${horas}h`;
}

/**
 * Lee una marca de tiempo como la que devuelve la API.
 *
 * D1 guarda `fecha_registro` con CURRENT_TIMESTAMP, que produce
 * «2026-09-14 18:00:00»: UTC, con un espacio en medio y sin ninguna marca de
 * zona. Ese formato no es ISO, así que el navegador lo lee con su analizador
 * indulgente, y ese decide que la hora es LOCAL. En Aguascalientes, que va seis
 * horas por detrás de UTC, un registro hecho a mediodía se guarda como las 18:00
 * y el panel lo entendía como las 18:00 de aquí: seis horas de más, en todas las
 * fechas del padrón, siempre en la misma dirección.
 *
 * Añadir la «T» y la «Z» es lo único que hace falta para que el navegador lea la
 * cadena como lo que es. Se comprueba la forma antes de tocarla para no romper
 * las que ya vengan en ISO el día que la API cambie de formato.
 */
export function desdeLaApi(valor) {
  if (!valor) return null;
  const fecha =
    typeof valor === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor)
      ? new Date(`${valor.replace(' ', 'T')}Z`)
      : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * El día al que pertenece un instante, para agrupar por fecha.
 *
 * `toISOString().split('T')[0]` parecía servir para esto y no sirve: da el día
 * en UTC, no el de quien mira la pantalla. Con seis horas de diferencia, todo lo
 * ocurrido a partir de las 18:00 de aquí cae en el día siguiente, y la gráfica
 * del tablero estrenaba una columna de mañana antes de que aquí anocheciera.
 *
 * Los getters sin `UTC` leen el día local, que es el que la persona reconoce
 * como «hoy».
 *
 * Espera una fecha válida. Quien filtra las inválidas es `desdeLaApi`, que
 * devuelve `null` ante cualquier marca que no se pueda leer; concentrar ahí esa
 * comprobación evita repetirla en cada sitio que agrupa. Llamar a esto con un
 * `new Date('basura')` daría «NaN-NaN-NaN» sin quejarse, así que la entrada
 * tiene que venir de `desdeLaApi` o de un `new Date()` recién construido.
 */
export function claveDelDia(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
