import "./globals.css";

export const metadata = {
  title: "Drop — file sharing",
  description: "Upload any file, get a link.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Old browsers (Kindle etc.) can't run this page: send them to the plain version. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{new Function("var o={};o?.a;o??1;class K{#p=1}")}catch(e){location.replace("/lite")}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
