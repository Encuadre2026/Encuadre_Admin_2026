import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { comprobarSecreto, guardarSesion, haySesion, olvidarSesion } from '../api/cliente';
import { Loader2, ArrowRight, Eye, EyeOff, AlertTriangle } from 'lucide-react';

/** Las tres barras del favicon, que son la marca del panel. */
function MarcaEncuadre() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <rect x="4" y="17" width="5" height="10" rx="1" opacity="0.4" />
      <rect x="13" y="11" width="5" height="16" rx="1" opacity="0.7" />
      <rect x="22" y="5" width="5" height="22" rx="1" />
    </svg>
  );
}

export default function Login() {
  const [secret, setSecret] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Si ya hay token, mandarlo al dashboard (el dashboard verificará si es válido)
  useEffect(() => {
    if (haySesion()) {
      navigate('/dashboard');
    } else {
      // El navegador pudo cerrarse y reabrirse: entonces el token persiste pero
      // el secreto no. Se limpia el resto para no entrar en un bucle de
      // redirecciones entre login y dashboard.
      olvidarSesion();
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!secret.trim()) return;

    setLoading(true);
    setError('');

    // Se valida contra la API antes de guardar nada. Y se distingue una
    // contraseña incorrecta de un problema de conexión: antes ambos casos
    // decían «contraseña incorrecta», lo que mandaba a probar contraseñas
    // cuando el fallo estaba en otro sitio.
    const { valido, error: fallo } = await comprobarSecreto(secret.trim());

    if (!valido) {
      setError(fallo.message);
      setLoading(false);
      return;
    }

    // Un identificador aleatorio como señal de sesión. No contiene el secreto:
    // solo indica que alguien se autenticó. El secreto real va en
    // sessionStorage, que se vacía al cerrar el navegador.
    guardarSesion(secret.trim());
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="acceso">
      {/* De qué es este panel. La pantalla de acceso no lo decía en ninguna
          parte —«Acceso Administrativo · Panel de control»— y es la primera que
          ve alguien que llega desde un enlace. */}
      <section className="acceso-identidad">
        <div className="acceso-marca">
          <MarcaEncuadre />
          <span className="rotulo-seccion">Universidad Autónoma de Aguascalientes</span>
        </div>

        <div className="acceso-bloque">
          <div className="rotulo-seccion text-gold">36 FTD</div>
          <h1 className="acceso-titulo">
            Futurología<br />y Tendencia<br />
            <span className="acceso-titulo-acento">del Diseño</span>
          </h1>
          <div className="acceso-filete" />
        </div>
      </section>

      <section className="acceso-formulario">
        <div className="acceso-encabezado">
          <div className="rotulo-seccion">Acceso administrativo</div>
          <h2 className="acceso-titulo-formulario">Entrar al panel</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="secret">Contraseña</label>
            <div className="acceso-campo">
              <input
                id="secret"
                type={verClave ? 'text' : 'password'}
                className="input-field"
                placeholder="Ingresa la contraseña"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                disabled={loading}
                autoFocus
              />
              {/* Se escribe a ciegas una contraseña que llega por otro canal, y
                  un espacio de más se lee igual que una contraseña equivocada. */}
              <button
                type="button"
                className="acceso-ojo"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar la contraseña' : 'Ver la contraseña'}
              >
                {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            // `role="alert"` para que el fallo se anuncie en cuanto aparece: es
            // la única respuesta que recibe quien acaba de pulsar «Ingresar».
            <div className="acceso-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading || !secret.trim()}>
            {loading ? <Loader2 className="spin" size={20} /> : 'Ingresar al panel'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </section>
    </div>
  );
}
