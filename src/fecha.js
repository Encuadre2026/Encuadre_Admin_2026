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
