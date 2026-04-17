import { useState, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start with initialValue so server and first client render match,
  // avoiding hydration mismatches. Read from localStorage after mount.
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const item = window.localStorage.getItem(key);
      if (item && item !== 'undefined' && item !== 'null') {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    } finally {
      hydratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Update localStorage whenever the value changes, but only after the initial
  // hydration read completes so we don't overwrite the stored value with the
  // initialValue on first mount.
  useEffect(() => {
    if (typeof window === 'undefined' || !hydratedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [key, storedValue]);

  // Return a wrapped version of useState's setter function that accepts value or function
  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      setStoredValue(value);
    } catch (error) {
      console.error('Error setting value:', error);
    }
  };

  return [storedValue, setValue];
}

