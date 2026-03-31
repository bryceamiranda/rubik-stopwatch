import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rubik's Voice Timer",
  description: "Voice-activated Rubik's cube timer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
