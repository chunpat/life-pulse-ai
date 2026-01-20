
import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// 注册 Service Worker 实现 PWA 离线支持与自动更新
registerSW({ immediate: true });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
