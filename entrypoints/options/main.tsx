import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/tailwind.css';
import App from './App';

document.documentElement.classList.toggle('dark', matchMedia('(prefers-color-scheme: dark)').matches);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
