import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Solo Inter: el panel es una herramienta de trabajo, no una pieza de marca.
// Ahorrarse la segunda familia es medio megabyte menos que descargar cada
// manana en la oficina.
import '@fontsource-variable/inter';
import './styles.css';
import './i18n';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('No se encontro el elemento #root en index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
