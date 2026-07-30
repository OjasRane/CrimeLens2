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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { const saved = localStorage.getItem('fatal-theme'); const theme = saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = theme; } catch {}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
