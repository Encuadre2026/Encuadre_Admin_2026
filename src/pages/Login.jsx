import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Si ya hay token, mandarlo al dashboard (el dashboard verificará si es válido)
  useEffect(() => {
    const token = localStorage.getItem('ENCUADRE_ADMIN_TOKEN');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!secret.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Hacemos una petición rápida de prueba para ver si el secret es correcto
      const res = await fetch('https://encuadre-2026-api.sitio-392.workers.dev/api/admin/registros', {
        headers: {
          'Authorization': `Bearer ${secret.trim()}`
        }
      });

      if (!res.ok) {
        throw new Error('Contraseña incorrecta o sin autorización.');
      }

      // Si fue exitoso, guardamos el token y redirigimos
      localStorage.setItem('ENCUADRE_ADMIN_TOKEN', secret.trim());
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <div className="flex flex-col items-center gap-4 mb-8 text-center">
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
            <label className="input-label" htmlFor="secret">Contraseña Maestra (Secret)</label>
            <input
              id="secret"
              type="password"
              className="input-field"
              placeholder="Ingresa el ADMIN_SECRET"
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
