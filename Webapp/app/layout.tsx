"use client";

import "./globals.css";
import AuthProvider from "@/contexts/auth";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background">
        <div className="bg-background bg-center bg-cover fixed bg-triangles w-[100vw] h-[100vh] m-0 -z-10"><div className="bg-background opacity-50 w-full h-full z-0"></div></div>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
