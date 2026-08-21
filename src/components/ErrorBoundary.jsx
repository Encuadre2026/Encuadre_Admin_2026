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
        <div className="pantalla-error">
          <div className="card error-tarjeta">
            <div className="error-icono">
              <AlertTriangle size={36} />
            </div>
            <h2 className="error-titulo">Algo salió mal</h2>
            <p className="error-mensaje">
              Ocurrió un error inesperado en la aplicación. Puedes intentar recargar la página o volver al inicio.
            </p>
            {this.state.error && (
              <div className="error-detalle">
                {this.state.error.message}
              </div>
            )}
            <div className="error-acciones">
              <button onClick={() => window.location.reload()} className="btn btn-primary">
                <RefreshCw size={16} /> Recargar página
              </button>
              <button onClick={this.handleReset} className="btn btn-outline">
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
