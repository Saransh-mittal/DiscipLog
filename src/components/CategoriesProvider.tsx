"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { UserCategory } from "@/lib/logs";

interface CategoriesContextValue {
  categories: UserCategory[];
  allCategories: UserCategory[];
  loading: boolean;
  refreshCategories: () => void;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  allCategories: [],
  loading: true,
  refreshCategories: () => {},
});

export function useCategoriesContext() {
  return useContext(CategoriesContext);
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [allCategories, setAllCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(() => {
    setLoading(true);
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        setAllCategories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const categories = useMemo(
    () => allCategories.filter((c) => !c.isArchived),
    [allCategories]
  );

  return (
    <CategoriesContext.Provider
      value={{ categories, allCategories, loading, refreshCategories: fetchCategories }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}
