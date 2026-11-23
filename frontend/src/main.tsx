import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import App from './App.tsx';
import './index.css';

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider> & { children: React.ReactNode }) {
  return <NextThemesProvider {...(props as any)}>{children}</NextThemesProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
