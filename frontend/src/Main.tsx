import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
import './index.css'  
console.log('✅ main.tsx loaded');

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (rootElement) {
  console.log('✅ Mounting React...');
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('❌ Root not found! Is index.html in the correct place?');
}