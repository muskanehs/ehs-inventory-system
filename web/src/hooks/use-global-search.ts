import { useEffect, useState } from "react";
import { useSearchStore } from "@/store/search";

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export function useGlobalSearch() {
  const query = useSearchStore((s) => s.query);
  const debouncedQuery = useDebouncedValue(query);

  return { query, debouncedQuery };
}
