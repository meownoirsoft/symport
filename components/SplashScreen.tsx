"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("splashShown")) return;
    sessionStorage.setItem("splashShown", "1");

    setShow(true);
    const fadeTimer = setTimeout(() => setFading(true), 2800);
    const hideTimer = setTimeout(() => setShow(false), 3300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`transition-all duration-700 ease-out ${
          fading ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        <Image
          src="/logo.png"
          alt="Symport"
          width={288}
          height={288}
          className="rounded-3xl shadow-lg shadow-sky-900/40"
          priority
        />
      </div>

    </div>
  );
}
