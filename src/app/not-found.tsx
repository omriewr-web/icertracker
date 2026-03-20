import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a1628] p-8">
      <h1 className="text-[#c9a84c] text-6xl font-bold mb-2 font-heading">404</h1>
      <h2 className="text-slate-200 text-xl mb-4">Page not found</h2>
      <p className="text-slate-400 mb-8 text-center max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-[#c9a84c] text-[#0a1628] rounded font-semibold hover:opacity-90 transition-opacity"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
