// Chrome-free wrapper for printable documents (receipts, certificates).
// Deliberately renders no dashboard shell so the page prints clean; the root
// layout still provides <html>/<body> and fonts.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-100 print:bg-white">{children}</div>
}
