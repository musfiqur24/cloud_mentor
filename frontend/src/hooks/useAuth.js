import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.auth.restoreSession()
      .then((restoredUser) => {
        if (active) setUser(restoredUser);
      })
      .catch(() => {
        // A missing or expired refresh cookie simply means this browser starts
        // at the sign-in screen. It is not an application error.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    setError('');
    try {
      const nextUser = await api.auth.signIn({ email, password });
      setUser(nextUser);
      return nextUser;
    } catch (requestError) {
      const message = requestError?.message || 'Could not sign in. Please try again.';
      setError(message);
      throw requestError;
    }
  }, []);

  const signUp = useCallback(async ({ name, email, password }) => {
    setError('');
    try {
      const nextUser = await api.auth.signUp({ name, email, password });
      setUser(nextUser);
      return nextUser;
    } catch (requestError) {
      const message = requestError?.message || 'Could not create your account. Please try again.';
      setError(message);
      throw requestError;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError('');
    try {
      await api.auth.signOut();
    } finally {
      setUser(null);
    }
  }, []);

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError: () => setError('')
  };
}
