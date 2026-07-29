import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fatal Investigation",
  description: "Analog brutalist investigation canvas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
