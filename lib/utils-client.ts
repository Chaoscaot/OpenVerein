import { useState, useEffect } from "react";

export function getCountries(lang = "de"): Array<string> {
  const A = 65;
  const Z = 90;
  const countryName = new Intl.DisplayNames([lang], { type: "region" });
  const countries: string[] = [];
  for (let i = A; i <= Z; ++i) {
    for (let j = A; j <= Z; ++j) {
      const code = String.fromCharCode(i) + String.fromCharCode(j);
      const name = countryName.of(code);
      if (code !== name && name) {
        countries.push(name);
      }
    }
  }
  return [...new Set(countries)];
}

export function useDebounce<T>(cb: T, delay: number): T {
  const [debounceValue, setDebounceValue] = useState<T>(cb);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebounceValue(cb);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [cb, delay]);
  return debounceValue;
}
