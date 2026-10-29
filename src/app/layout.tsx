import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "AI Wardrobe — il tuo guardaroba intelligente", template: "%s · AI Wardrobe" },
  description: "Organizza il guardaroba e crea outfit con il tuo stylist AI personale.",
  applicationName: "AI Wardrobe",
  appleWebApp: { capable: true, title: "Wardrobe", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2eb" },
    { media: "(prefers-color-scheme: dark)", color: "#12110f" },
  ],
};

// Applica il tema salvato prima del primo paint, evitando il flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${display.variable} ${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
