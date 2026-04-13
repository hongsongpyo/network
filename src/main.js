// src/main.js

import { initApp } from './app.js';

function bootstrap() {
  const root = document.getElementById('app');

  if (!root) {
    throw new Error('Root element "#app" was not found.');
  }

  initApp(root);
}

bootstrap();

