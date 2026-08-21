/**
 * El estado de un cupo, calculado en un solo sitio.
 *
 * Un cupo son dos bolsas independientes: la general y la reservada a la UAA.
 * La regla que decide qué anunciar —«Disponible», «Solo general», «Lleno»—
 * vivía dentro del `map` de la pantalla de Cupos, así que el dashboard, que
 * ahora también enseña el estado de cada taller, tendría que haberla copiado.
 * Dos copias de una regla de negocio a dos pantallas de distancia es
 * exactamente lo que ya pasó con `institucion.includes('UAA')`: coincidían
 * hasta que dejaron de coincidir.
 *
 * El panel muestra; no decide. Los lugares reservados y el reparto entre
 * bolsas los declara la API por taller.
 */
export function estadoDeCupo(cupo) {
  const reservadosUaa = cupo.lugares_reservados_uaa ?? 0;
  const inscritosUaa = cupo.inscritos_uaa ?? 0;
  const inscritosGeneral = cupo.inscritos_general ?? 0;
  const inscritos = cupo.inscritos ?? inscritosUaa + inscritosGeneral;
  const capacidad = cupo.cupo_maximo + reservadosUaa;
  const porcentaje = capacidad ? (inscritos / capacidad) * 100 : 0;

  // La insignia miraba solo el total contra la capacidad total, así que un
  // taller con la reserva UAA agotada y hueco general se anunciaba en verde
  // como «Disponible» —y ningún estudiante de la UAA podía inscribirse en él—.
  const generalLleno = inscritosGeneral >= cupo.cupo_maximo;
  const uaaLleno = reservadosUaa > 0 && inscritosUaa >= reservadosUaa;

  let insignia = 'Disponible';
  let clase = 'disponible';
  if (generalLleno && uaaLleno) {
    insignia = 'Lleno';
    clase = 'lleno';
  } else if (uaaLleno) {
    insignia = 'Solo general';
    clase = 'casi-lleno';
  } else if (generalLleno) {
    insignia = 'Solo UAA';
    clase = 'casi-lleno';
  } else if (porcentaje >= 80) {
    insignia = 'Casi lleno';
    clase = 'casi-lleno';
  }

  return {
    reservadosUaa,
    inscritosUaa,
    inscritosGeneral,
    inscritos,
    capacidad,
    porcentaje,
    generalLleno,
    uaaLleno,
    insignia,
    clase,
    // Los porcentajes de cada bolsa por separado, que es lo que dibujan las dos
    // barras de la pantalla de Cupos.
    porcentajeGeneral: cupo.cupo_maximo ? Math.min(100, (inscritosGeneral / cupo.cupo_maximo) * 100) : 0,
    porcentajeUaa: reservadosUaa ? Math.min(100, (inscritosUaa / reservadosUaa) * 100) : 0,
  };
}
