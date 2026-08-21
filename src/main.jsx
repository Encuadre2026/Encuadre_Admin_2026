import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';

// La fuente va con el panel, no se pide a un tercero.
//
// `--font-family` llevaba pidiendo 'Inter' desde el principio y nadie la
// cargaba nunca: el panel se veía con Segoe UI en Windows, con San Francisco en
// un Mac y con lo que tocara en Linux. Autoalojarla lo deja igual en las tres,
// sin una petición a Google en cada carga y sin depender de que responda.
//
// Son siete recortes por rango Unicode y el navegador solo se descarga el que
// necesita: para un panel en español, el latino y ya.
import '@fontsource-variable/inter';
// La segunda familia, solo para titulares y cifras grandes. Es variable y se
// carga el mismo recorte latino que Inter: un archivo más, no siete.
import '@fontsource-variable/bricolage-grotesque';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
