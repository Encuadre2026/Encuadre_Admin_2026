/**
 * Cliente de la API del Worker.
 *
 * Hasta ahora cada llamada hacía `if (!res.ok) throw new Error('Error al
 * aprobar pago')` y tiraba a la basura lo que había respondido el servidor. El
 * Worker explica con precisión qué pasó —«este pago ya fue aprobado», «el
 * participante no existe»— y el panel enseñaba en su lugar un texto genérico
 * que no ayuda a decidir qué hacer.
 *
 * La API trae ahora un contrato uniforme: toda respuesta lleva `ok`, y los
 * errores además `codigo` y `mensaje`. `mensaje` es el texto que se le enseña a
 * la persona, y `codigo` es para que el panel decida cómo reaccionar sin tener
 * que comparar cadenas en español.
 */

const API = import.meta.env.VITE_API_URL;

export const CLAVE_SECRETO = 'ENCUADRE_ADMIN_SECRET';

/** Un error de la API, con el código que permite distinguirlo. */
export class ErrorApi extends Error {
  constructor(mensaje, codigo, status) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.status = status;
  }

  /** La sesión caducó o el secreto dejó de ser válido. */
  get esNoAutorizado() {
    return this.codigo === 'NO_AUTORIZADO' || this.status === 401;
  }
}

/**
 * Señal de «alguien inició sesión». No contiene el secreto.
 *
 * Sobrevive al cierre del navegador; el secreto no, porque va en
 * sessionStorage. Esa asimetría es deliberada, y por eso hay que comprobar
 * siempre los dos: con el token pero sin el secreto, la sesión no sirve.
 */
const CLAVE_TOKEN = 'ENCUADRE_ADMIN_TOKEN';

export function obtenerSecreto() {
  return sessionStorage.getItem(CLAVE_SECRETO);
}

/** Hay sesión utilizable solo si están las dos piezas. */
export function haySesion() {
  return Boolean(localStorage.getItem(CLAVE_TOKEN) && sessionStorage.getItem(CLAVE_SECRETO));
}

export function guardarSesion(secreto) {
  localStorage.setItem(CLAVE_TOKEN, crypto.randomUUID());
  sessionStorage.setItem(CLAVE_SECRETO, secreto);
}

export function olvidarSesion() {
  sessionStorage.removeItem(CLAVE_SECRETO);
  localStorage.removeItem(CLAVE_TOKEN);
}

/**
 * Saca el motivo de una respuesta fallida.
 *
 * Casi todas las rutas responden JSON, pero la del comprobante devuelve el PDF
 * en binario y sus errores van en texto plano, así que hay que mirar el tipo.
 */
async function motivoDelError(res) {
  const tipo = res.headers.get('Content-Type') || '';
  try {
    if (tipo.includes('application/json')) {
      const cuerpo = await res.json();
      return {
        mensaje: cuerpo.mensaje || cuerpo.message || cuerpo.error || 'Error inesperado.',
        codigo: cuerpo.codigo,
      };
    }
    const texto = (await res.text()).trim();
    return { mensaje: texto || 'Error inesperado.', codigo: undefined };
  } catch {
    // Un cuerpo ilegible no debe tapar el fallo original.
    return { mensaje: 'El servidor respondió de forma inesperada.', codigo: undefined };
  }
}

/**
 * Comprueba un secreto antes de guardarlo.
 *
 * El login no puede usar `pedir`, porque este lee el secreto de sessionStorage
 * y en ese momento todavía no está: hay que validarlo primero para decidir si
 * merece guardarse.
 *
 * Devuelve un ErrorApi en vez de lanzarlo para que quien llama distinga sin
 * esfuerzo entre «la contraseña no vale» y «no se pudo hablar con el servidor».
 * Antes cualquier fallo se anunciaba como contraseña incorrecta, incluida una
 * caída de red, lo que mandaba a la persona a probar contraseñas cuando el
 * problema estaba en otro sitio.
 */
export async function comprobarSecreto(secreto) {
  try {
    const res = await fetch(`${API}/api/admin/registros`, {
      headers: { Authorization: `Bearer ${secreto}` },
    });

    if (res.ok) return { valido: true };

    if (res.status === 401) {
      return { valido: false, error: new ErrorApi('Contraseña incorrecta.', 'NO_AUTORIZADO', 401) };
    }

    const { mensaje, codigo } = await motivoDelError(res);
    return { valido: false, error: new ErrorApi(mensaje, codigo, res.status) };
  } catch {
    return {
      valido: false,
      error: new ErrorApi('No se pudo contactar con el servidor.', 'SIN_CONEXION', 0),
    };
  }
}

/**
 * Llama a la API con el secreto de administración.
 *
 * Lanza ErrorApi con el mensaje del servidor. Ante un 401 olvida la sesión,
 * porque seguir con un secreto que ya no vale solo produce más errores.
 */
export async function pedir(ruta, { esperaBinario = false, ...opciones } = {}) {
  const secreto = obtenerSecreto();
  if (!secreto) {
    olvidarSesion();
    throw new ErrorApi('Tu sesión expiró. Vuelve a iniciar sesión.', 'NO_AUTORIZADO', 401);
  }

  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${secreto}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  });

  if (res.status === 401) {
    olvidarSesion();
    throw new ErrorApi('Tu sesión expiró. Vuelve a iniciar sesión.', 'NO_AUTORIZADO', 401);
  }

  if (!res.ok) {
    const { mensaje, codigo } = await motivoDelError(res);
    throw new ErrorApi(mensaje, codigo, res.status);
  }

  return esperaBinario ? res.blob() : res.json();
}
