import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "MyGPT - Private Chatbot",
    description: "A free, private chatbot powered by Hugging Face.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
