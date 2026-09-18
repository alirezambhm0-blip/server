import React, { createContext, useContext, useState, useEffect } from 'react';
import { productsApi } from '@/api/productsApi';
import { useAuth } from './AuthContext';
import { Product } from '@/types/product';

type FavoritesContextType = {
  favorites: string[]; // IDs of favorite products
  toggleFavorite: (product: Product) => Promise<void>;
  isFavorite: (productId: string) => boolean;
  refreshFavorites: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  const refreshFavorites = async () => {
    if (!isLoggedIn) {
      setFavorites([]);
      return;
    }
    try {
      const favProducts = await productsApi.getFavorites();
      setFavorites(favProducts.map(p => p.id));
    } catch (e) {
      console.warn('[Favorites] Failed to refresh', e);
    }
  };

  useEffect(() => {
    refreshFavorites();
  }, [isLoggedIn]);

  const toggleFavorite = async (product: Product) => {
    if (!isLoggedIn) return;

    // Optimistic Update
    const isCurrentlyFav = favorites.includes(product.id);
    if (isCurrentlyFav) {
      setFavorites(prev => prev.filter(id => id !== product.id));
    } else {
      setFavorites(prev => [...prev, product.id]);
    }

    try {
      await productsApi.toggleFavorite(product.id);
    } catch (e) {
      // Rollback on error
      if (isCurrentlyFav) {
        setFavorites(prev => [...prev, product.id]);
      } else {
        setFavorites(prev => prev.filter(id => id !== product.id));
      }
    }
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite, refreshFavorites }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within a FavoritesProvider');
  return context;
};
