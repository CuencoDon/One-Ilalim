import "./globals.css";
import Header from "@/app/components/Header";
import { AuthProvider } from "@/app/lib/AuthContext";
import { DataProvider } from "@/app/lib/DataContext";
import { nunito } from "@/app/lib/fonts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} font-sans`}>
      <body className="h-screen overflow-hidden">
        <AuthProvider>
          <DataProvider>
            <Header />
            <main className="pt-[72px] h-full overflow-auto">
              {children}
            </main>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}