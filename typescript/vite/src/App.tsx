import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useSettings } from '@/providers/SettingsProvider';
import { AppRouting } from '@/routing';
import { PathnameProvider } from '@/providers';
import { Toaster } from '@/components/ui/sonner';

const { BASE_URL } = import.meta.env;

const App = () => {
  const { settings, getThemeMode } = useSettings();

  useEffect(() => {
    const resolvedThemeMode = getThemeMode();
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add(resolvedThemeMode);
  }, [getThemeMode, settings]);

  return (
    <BrowserRouter
      basename={BASE_URL}
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
    >
      <PathnameProvider>
        <AppRouting />
      </PathnameProvider>
      <Toaster />
    </BrowserRouter>
  );
};

export { App };
