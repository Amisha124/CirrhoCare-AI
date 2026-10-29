import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from '@/app/AppRoutes';
import { AuthProvider } from '@/app/AuthContext';
import { ToastProvider } from '@/app/ToastContext';
import { LanguageProvider } from '@/app/LanguageContext';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LanguageProvider>
            <AppRoutes />
          </LanguageProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
