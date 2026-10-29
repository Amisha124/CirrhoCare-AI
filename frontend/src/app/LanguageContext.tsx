import React, { createContext, useContext, useState } from 'react';
import { translations } from '@/utils/translations';

export type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isHindi: boolean;
  t: (enOrKey: string, hi?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  isHindi: false,
  t: (enOrKey, hi) => hi || enOrKey,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('cirrhocare_lang') || localStorage.getItem('cirrhocare_patient_lang');
    return saved === 'hi' ? 'hi' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cirrhocare_lang', lang);
    localStorage.setItem('cirrhocare_patient_lang', lang);
  };

  const isHindi = language === 'hi';

  const t = (enOrKey: string, hi?: string): string => {
    if (hi !== undefined) {
      return isHindi ? hi : enOrKey;
    }
    if (translations[enOrKey]) {
      return isHindi ? translations[enOrKey].hi : translations[enOrKey].en;
    }
    return enOrKey;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isHindi, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
