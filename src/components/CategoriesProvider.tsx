"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { UserCategory } from "@/lib/logs";

interface CategoriesContextValue {
  categories: UserCategory[];
  loading: boolean;
  refreshCategories: () => void;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  loading: true,
  refreshCategories: () => {},
});

export function useCategoriesContext() {
  return useContext(CategoriesContext);
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(() => {
    setLoading(true);
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <CategoriesContext.Provider
      value={{ categories, loading, refreshCategories: fetchCategories }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}
