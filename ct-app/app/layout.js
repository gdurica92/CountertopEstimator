import './globals.css';

export const metadata = {
  title: 'Countertop Estimator',
  description: 'Upload cabinet shop drawings, extract dimensions, calculate slab count and costs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.x/dist/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
