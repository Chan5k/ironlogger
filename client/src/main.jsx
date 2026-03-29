import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import './index.css';

function routerBasename() {
  const b = import.meta.env.BASE_URL || '/';
  if (b === '/') return undefined;
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
