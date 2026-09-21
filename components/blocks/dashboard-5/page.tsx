import { SecurityDashboard } from "./components/security-dashboard"

export function Page() {
  return (
    <main
      className="bg-background min-h-svh w-full p-3 sm:p-4 lg:p-6"
      aria-labelledby="page-heading"
    >
      <SecurityDashboard />
    </main>
  )
}