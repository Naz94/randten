import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RANDTEN",
  description: "A moderated, privacy-preserving South African marketplace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  );
}
