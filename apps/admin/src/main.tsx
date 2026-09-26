import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Solo Inter: el panel es una herramienta de trabajo, no una pieza de marca.
// Ahorrarse la segunda familia es medio megabyte menos que descargar cada
// manana en la oficina.
import '@fontsource-variable/inter';
import './styles.css';
import './i18n';
import App from './App';
import { ToastProvider } from './components/ToastProvider';

const container = document.getElementById('root');
if (!container) {
  throw new Error('No se encontro el elemento #root en index.html');
}

createRoot(container).render(
  <StrictMode>
    {/*
      Los avisos envuelven a TODA la aplicacion, incluida la pantalla de
      acceso. Si colgaran del panel ya abierto, el unico sitio donde no se
      podrian dar avisos seria justo donde mas falta hacen: al entrar.
    */}
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
