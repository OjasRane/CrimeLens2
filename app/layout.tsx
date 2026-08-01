import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrimeLens",
  description: "Theme-aware investigation workspace",
};

const themeInitScript = `
(function() {
  try {
    var key = "crimelens-theme";
    var stored = window.localStorage.getItem(key);
    var mode = stored === "terminal" || stored === "archive"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "terminal" : "archive");
    document.documentElement.dataset.theme = mode;
    document.documentElement.classList.toggle("dark", mode === "terminal");
  } catch (_) {
    document.documentElement.dataset.theme = "archive";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
