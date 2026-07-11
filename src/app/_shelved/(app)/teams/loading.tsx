export default function TeamsLoading() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-8 w-40 rounded-xl bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="h-1 bg-gray-200" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gray-200" />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded-lg bg-gray-200" />
                  <div className="h-3 w-20 rounded-lg bg-gray-100" />
                </div>
              </div>
              <div className="h-14 rounded-lg bg-gray-100" />
              <div className="h-9 rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
