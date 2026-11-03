import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="eyebrow">VfixurPC</p>
        <h1>Page not found</h1>
        <p>The page you requested is not available.</p>
        <Link className="button-primary" href="/">Return home</Link>
      </section>
    </main>
  );
}
