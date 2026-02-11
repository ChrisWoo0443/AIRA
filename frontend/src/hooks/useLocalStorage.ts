import { useState, useCallback } from 'react';

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

  // Update both React state and localStorage synchronously
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function (similar to useState)
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        // Update React state
        setStoredValue(valueToStore);

        // Write to localStorage synchronously (avoids race conditions)
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (storageError) {
          // Handle QuotaExceededError (DOMException with code 22)
          if (
            storageError instanceof DOMException &&
            (storageError.code === 22 || storageError.name === 'QuotaExceededError')
          ) {
            console.warn(`localStorage quota exceeded for key "${key}". State updated but not persisted.`);
          } else {
            throw storageError;
          }
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
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
