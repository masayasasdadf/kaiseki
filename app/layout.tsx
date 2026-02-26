import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaiseki Analytics",
  description: "広告流入からCVまでを一目で把握できる計測OS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
