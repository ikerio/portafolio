/* =====================================================================
   main.ts — entry point. Loads the canonical design tokens (from the
   existing DesignSystem), global layout, and card styles, then boots the
   App. Any boot failure falls back to the accessible CV.
   ===================================================================== */

import '../DesignSystem/styles/tokens.css';
import './styles/global.css';
import './ui/cards.css';
import './ui/gradiente.css';

import { App } from './App';

const app = new App();
app.start().catch((err) => {
  console.error('[portfolio] failed to start:', err);
  document.getElementById('loader')?.classList.add('loaded');
  document.body.classList.add('cv-open', 'cv-permanent');
});

// Expose for quick console debugging in dev.
if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = app;
