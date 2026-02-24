import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h2 className="text-xl font-semibold mb-2">Not Found</h2>
      <p className="text-muted-foreground mb-4">
        The client you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/clients"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Back to Clients
      </Link>
    </div>
  )
}
