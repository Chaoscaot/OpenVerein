import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getCountries(lang = "de"): Array<string> {
    const A = 65;
    const Z = 90;
    const countryName = new Intl.DisplayNames([lang], { type: "region" });
    const countries: string[] = [];
    for (let i = A; i <= Z; ++i) {
        for (let j = A; j <= Z; ++j) {
            let code = String.fromCharCode(i) + String.fromCharCode(j);
            let name = countryName.of(code);
            if (code !== name && name) {
                countries.push(name);
            }
        }
    }
    return [...new Set(countries)];
}
