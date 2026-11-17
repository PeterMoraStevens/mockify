import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { getCurrentUser } from "@/lib/server/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mockify",
  description:
    "Self-hosted, peer-to-peer mock interviews: shared editor, video, whiteboard and a real judge.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar
            user={
              user
                ? { displayName: user.displayName, username: user.username }
                : null
            }
          />
          <Toaster
            position="bottom-left"
            toastOptions={{
              className:
                "!rounded-base !border-2 !border-border !shadow-shadow !font-base",
            }}
          />
          {children}
        </ThemeProvider>
        <Script
          src="https://umami.petermorastevens.rocks/script.js"
          data-website-id="95367f2f-7699-4c5a-8ddc-792997811c05"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
