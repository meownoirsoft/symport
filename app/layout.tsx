import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import OnboardingModal from "@/components/OnboardingModal";
import SplashScreen from "@/components/SplashScreen";

export const metadata: Metadata = {
  title: "Symport",
  description: "Capture paper. Extract data. Search and export.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans pb-14">
        <SplashScreen />
        {children}
        <BottomNav />
        <OnboardingModal />
      </body>
    </html>
  );
}
