export default function Loading() {
  return (
    <div className="flex gap-6 p-6">
      <div className="h-[600px] w-56 shrink-0 animate-pulse rounded-md bg-muted" />
      <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[5/7] animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
