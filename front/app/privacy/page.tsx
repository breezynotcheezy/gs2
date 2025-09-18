export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-amber-50">
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-mono font-bold mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-6">Last updated: 2025-09-18</p>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-mono font-semibold">Information We Collect</h2>
          <p className="text-gray-300">We collect only the minimum information required to provide the service, such as authentication credentials you supply and the play-by-play text you upload to run analytics. We do not sell your data.</p>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-mono font-semibold">How We Use Information</h2>
          <p className="text-gray-300">Uploaded text is processed to derive analytics. We may store anonymized, aggregated metrics to improve quality and reliability. Access is limited to authorized personnel.</p>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-mono font-semibold">Data Security</h2>
          <p className="text-gray-300">We use industry-standard security practices and limit retention. You can request deletion of your data by contacting support.</p>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-mono font-semibold">Contact</h2>
          <p className="text-gray-300">For privacy inquiries, contact: support@example.com</p>
        </section>
      </main>
    </div>
  )
}
