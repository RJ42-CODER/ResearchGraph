import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ResearchGraph",
  description: "AI-Powered Visual Research Workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className={`${poppins.className} ${poppins.variable} ${jetbrainsMono.variable} antialiased bg-black text-white transition-colors duration-200`}
      >
        {children}
      </body>
    </html>
  );
}
