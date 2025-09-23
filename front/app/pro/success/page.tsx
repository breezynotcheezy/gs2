export default function ProSuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-amber-50">
      <main className="container mx-auto px-4 py-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">Thanks for upgrading!</h1>
        <p className="text-xs text-gray-400 font-mono mt-2">Your Pro features will be available immediately.</p>
        <a className="inline-block mt-6 text-xs text-amber-200 font-mono underline" href="/">Return to Dashboard</a>
      </main>
    </div>
  )
}
