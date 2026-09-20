import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
