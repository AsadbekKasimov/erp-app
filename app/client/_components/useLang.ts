"use client";
import { useState, useEffect } from "react";
import { translations, Lang } from "./translations";

export function useLang() {
  const [lang, setLang] = useState<Lang>("ru");

  useEffect(() => {
    const saved = localStorage.getItem("client_lang") as Lang;
    if (saved === "ru" || saved === "uz") setLang(saved);

    // Listen for lang changes from ClientShell
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "client_lang" && (e.newValue === "ru" || e.newValue === "uz")) {
        setLang(e.newValue as Lang);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return { lang, t: translations[lang] };
}