import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: 'var(--color-bg-base)',
        }}>
          <div className="card" style={{
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            padding: '2.5rem',
          }}>
            <div style={{
              backgroundColor: 'rgba(231, 76, 60, 0.15)',
              padding: '1rem',
              borderRadius: '50%',
              display: 'inline-flex',
              marginBottom: '1.5rem',
            }}>
              <AlertTriangle size={36} color="var(--color-danger)" />
            </div>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Algo salió mal</h2>
            <p style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
            }}>
              Ocurrió un error inesperado en la aplicación. Puedes intentar recargar la página o volver al inicio.
            </p>
            {this.state.error && (
              <div style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                color: 'var(--color-danger)',
                fontFamily: 'monospace',
                maxHeight: '100px',
                overflow: 'auto',
              }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
                style={{ fontSize: '0.875rem' }}
              >
                <RefreshCw size={16} /> Recargar página
              </button>
              <button
                onClick={this.handleReset}
                className="btn btn-outline"
                style={{ fontSize: '0.875rem' }}
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
