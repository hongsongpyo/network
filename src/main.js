// src/main.js

import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/panels.css';
import './styles/graph.css';
import './styles/themes.css';

import { initApp } from './app.js';

function bootstrap() {
  const root = document.getElementById('app');

  if (!root) {
    throw new Error('Root element "#app" was not found.');
  }

  initApp(root);
}

bootstrap();