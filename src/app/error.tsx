'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-red-400 text-xl mb-4">Something went wrong</h2>
      <p className="text-slate-400 mb-6">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#c9a84c] text-[#0a1628] rounded font-semibold hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
