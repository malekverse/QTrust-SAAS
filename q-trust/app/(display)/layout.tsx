// Full-screen, chrome-free wrapper for cast-to-TV display routes (leaderboard).
// The root layout still provides <html>/<body> and fonts.
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>
}
