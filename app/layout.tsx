import type React from "react"
import type { Metadata, Viewport } from "next"
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { MonthProvider } from "@/lib/month-context"
import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/toaster"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "TallerPro - Gestión de Taller Automotriz",
  description: "Sistema profesional de gestión para talleres de reparación de vehículos",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-taller.png",
    shortcut: "/logo-taller.png",
    apple: "/logo-taller.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0e255c",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">
        <MonthProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </MonthProvider>
        <Analytics />
      </body>
    </html>
  )
}
