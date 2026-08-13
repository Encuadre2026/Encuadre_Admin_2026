import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { comprobarSecreto, guardarSesion, haySesion, olvidarSesion } from '../api/cliente';
import { Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const [secret, setSecret] = useState('');
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full fade-in-up">
        <div className="flex flex-col items-center gap-4 mb-8 text-center" style={{ marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'var(--color-accent-gold-dim)', padding: '1rem', borderRadius: '50%' }}>
            <Lock size={32} color="var(--color-accent-gold)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Acceso Administrativo</h1>
            <p className="text-muted">Panel de control · Encuadre 2026</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="secret">Contraseña</label>
            <input
              id="secret"
              type="password"
              className="input-field"
              placeholder="Ingresa la contraseña"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem', backgroundColor: 'rgba(231,76,60,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading || !secret.trim()}>
            {loading ? <Loader2 className="spin" size={20} /> : 'Ingresar al Panel'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}
