import "./globals.css";

export const metadata = {
  title: "Drop — file sharing",
  description: "Upload any file, get a link.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
