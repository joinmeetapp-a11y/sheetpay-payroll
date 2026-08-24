import { useEffect, useState } from 'react';
import { auth } from './firebase';

export function useFirebaseConvexAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken: async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const user = auth.currentUser;
      if (!user) return null;
      return user.getIdToken(forceRefreshToken);
    },
  };
}
