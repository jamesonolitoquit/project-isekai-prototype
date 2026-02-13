import '../styles/globals.css';
import '../styles/artifact-forge.css';
import '../styles/morphing-station.css';
import '../styles/travel-progress.css';
import '../styles/tabbed-layout.css';
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;
