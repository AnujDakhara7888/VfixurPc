import legal from "@/content/legal.json";
export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-10 bg-white">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      {legal.terms.map((p, i) => (
        <p
          key={i}
          className={
            "mb-4 leading-7 " + (/^\d+\.\d+/.test(p) ? "font-bold text-lg" : "")
          }
        >
          {p}
        </p>
      ))}
    </main>
  );
}
