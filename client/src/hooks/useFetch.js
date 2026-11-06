import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for fetching data with loading, error, and refetch support.
 */
export function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        err.message ||
        'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

