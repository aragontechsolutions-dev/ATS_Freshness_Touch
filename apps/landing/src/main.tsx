import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Tipografias de la identidad visual, servidas desde nuestro propio dominio:
// no hay peticiones a Google Fonts, asi que la politica de seguridad puede
// seguir siendo estricta y no se comparte la visita con terceros.
import '@fontsource-variable/inter';
import '@fontsource-variable/montserrat';
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
