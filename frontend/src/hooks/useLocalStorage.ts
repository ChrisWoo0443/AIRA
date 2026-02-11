import { useState, useCallback, useEffect } from 'react';

/**
 * Type-safe localStorage hook with error handling.
 *
 * @param key - localStorage key
 * @param initialValue - default value if key doesn't exist
 * @returns [value, setValue, remove] tuple
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Lazy initial state - read from localStorage only on mount
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return initialValue;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Sync React state to localStorage after every state change
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      // Handle QuotaExceededError (DOMException with code 22)
      if (
        error instanceof DOMException &&
        (error.code === 22 || error.name === 'QuotaExceededError')
      ) {
        console.warn(`localStorage quota exceeded for key "${key}". State updated but not persisted.`);
      } else {
        console.error(`Error writing localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue]);

  // Update React state - functional updates flow through React's state queue
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setStoredValue(value);
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  // Remove from localStorage and reset to initial value
  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, remove];
}
