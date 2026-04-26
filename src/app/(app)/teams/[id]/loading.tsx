export default function TeamDetailLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-40 bg-gray-200 sm:h-56" />
      <div className="relative px-4 pb-4 pt-0 sm:px-6">
        <div className="-mt-10 flex items-end gap-4">
          <div className="h-20 w-20 rounded-2xl border-4 border-white bg-gray-200 sm:h-24 sm:w-24" />
          <div className="mb-2 space-y-2">
            <div className="h-6 w-40 rounded-lg bg-gray-200" />
            <div className="h-4 w-24 rounded-lg bg-gray-100" />
          </div>
        </div>
        <div className="mt-4 flex gap-4 border-b border-gray-200 pb-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-t-lg bg-gray-200" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
