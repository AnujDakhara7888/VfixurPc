import legal from "@/content/legal.json";
import Link from "next/link";
export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-10 bg-white">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      {legal.privacy.map((p, i) => (
        <p
          key={i}
          className={
            "mb-4 leading-7 " + (/^\d+\.\d+/.test(p) ? "font-bold text-lg" : "")
          }
        >
          {p}
        </p>
      ))}
      <Link className="text-blue-700 underline" href="/account-deletion">
        Request account deletion
      </Link>
    </main>
  );
}
