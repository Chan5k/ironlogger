import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
// Vite + React SPA: use `/react`. `@vercel/speed-insights/next` depends on `next/navigation` and is only for Next.js.
import { SpeedInsights } from '@vercel/speed-insights/react';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import AppDialogProvider from './components/AppDialogProvider.jsx';
import App from './App.jsx';
import './index.css';

function SpeedInsightsRouteBridge() {
  const { pathname } = useLocation();
  return <SpeedInsights framework="react" route={pathname} />;
}

function routerBasename() {
  const b = import.meta.env.BASE_URL || '/';
  if (b === '/') return undefined;
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <SpeedInsightsRouteBridge />
      <ThemeProvider>
        <AuthProvider>
          <AppDialogProvider>
            <App />
          </AppDialogProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
