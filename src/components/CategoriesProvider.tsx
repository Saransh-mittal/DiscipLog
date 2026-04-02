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
  updateCategory: (
    categoryId: string,
    updater: (category: UserCategory) => UserCategory
  ) => void;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  allCategories: [],
  loading: true,
  refreshCategories: () => {},
  updateCategory: () => {},
});

export function useCategoriesContext() {
  return useContext(CategoriesContext);
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [allCategories, setAllCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback((showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        setAllCategories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchCategories(false);
    });
  }, [fetchCategories]);

  const categories = useMemo(
    () => allCategories.filter((c) => !c.isArchived),
    [allCategories]
  );

  const updateCategory = useCallback(
    (categoryId: string, updater: (category: UserCategory) => UserCategory) => {
      setAllCategories((prev) =>
        prev.map((category) =>
          String(category._id) === categoryId ? updater(category) : category
        )
      );
    },
    []
  );

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        allCategories,
        loading,
        refreshCategories: fetchCategories,
        updateCategory,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}
