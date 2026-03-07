// 1. Global resets & base
import '../styles/globals.css';
// 2. Layout foundation: tokens must load before everything that uses them
import '../styles/layout-tokens.css';
import '../styles/spacing-system.css';
// 3. Component layers (build on tokens)
import '../styles/layout-components.css';
import '../styles/hero-card.css';
import '../styles/location-card.css';
// 4. Feature styles
import '../styles/visual-effects.css';
import '../styles/artifact-forge.css';
import '../styles/morphing-station.css';
import '../styles/travel-progress.css';
import '../styles/tabbed-layout.css';
import '../styles/hud.css'; // Phase 10: Hero's Reliquary HUD System
import '../client/styles/globalErrorBoundary.css';
import '../client/styles/weaverProcessing.css';
import '../client/styles/theme.css'; // Theme system with CSS variables
import '../styles/cinematicTextOverlay.css';
import '../styles/narrativeCodecs.css';
import '../styles/dice-3d.css';
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;
