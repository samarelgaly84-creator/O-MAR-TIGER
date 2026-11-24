import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.DEV && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-share-target.js', {scope: '/'}).catch(() => {
      // Ignore dev service worker registration failures in restricted contexts
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
