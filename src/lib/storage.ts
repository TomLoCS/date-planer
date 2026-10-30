import { useEffect, useState } from 'react';

/** useState, der den Wert im localStorage des Browsers behält (kein Backend nötig). */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // privater Modus / Speicher voll → App funktioniert trotzdem, nur ohne Merken
    }
  }, [key, value]);

  return [value, setValue] as const;
}
