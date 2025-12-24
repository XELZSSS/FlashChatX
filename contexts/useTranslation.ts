import { useContext } from 'react';
import { LanguageContext } from './LanguageContext';

// Custom hook for language context
export const useTranslation = () => useContext(LanguageContext);
