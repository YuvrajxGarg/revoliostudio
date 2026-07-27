import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted" });

export const metadata: Metadata = {
  title: "Revolio Studio",
  description: "Image, video and 3D generation powered by Revolio AI.",
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${geistMono.variable} ${schibsted.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem("revolio-theme")==="light";if(l)document.documentElement.classList.add("light");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",l?"#fafafa":"#0f0f0f");}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        {/* model-viewer's script now loads on-demand from
            GenerationDetailPanel instead of globally here — it's a
            Three.js-backed web component only ever needed when opening a 3D
            generation's detail view, not on every page load. */}
      </body>
    </html>
  );
}
