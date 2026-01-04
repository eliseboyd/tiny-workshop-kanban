import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // State to store our value - initialize with value from localStorage if available
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item && item !== 'undefined' && item !== 'null') {
        return JSON.parse(item);
      }
      return initialValue;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return initialValue;
    }
  });

  // Update localStorage whenever the value changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [key, storedValue]);

  // Return a wrapped version of useState's setter function
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
    } catch (error) {
      console.error('Error setting value:', error);
    }
  };

  return [storedValue, setValue];
}

