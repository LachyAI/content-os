import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { PinGate } from "@/components/pin-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Content OS",
  description: "Creator intelligence dashboard",
  appleWebApp: { capable: true, title: "Content OS", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground flex">
        <PinGate>
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen overflow-auto pt-12 md:pt-0">
            {children}
          </div>
        </PinGate>
      </body>
    </html>
  );
}
