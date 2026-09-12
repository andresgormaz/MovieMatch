import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MovieMatch",
  description: "Encuentra películas y series que realmente te van a gustar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MovieMatch" },
  // iOS ignores the SVG in manifest.webmanifest for home-screen icons --
  // needs its own PNG, or it falls back to a screenshot of the page.
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#090909",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Only used here to reserve room for BottomNav on mobile so its fixed
  // position never covers the last bit of a page's content -- BottomNav
  // does its own (redundant, harmless) session check to decide whether to
  // render at all, same as Navbar already does.
  const session = await auth();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className={`flex-1 ${session?.user ? "pb-20 sm:pb-0" : ""}`}>{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
