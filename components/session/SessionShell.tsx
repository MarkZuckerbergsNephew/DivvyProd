export default function SessionShell({
    header,
    children,
    footer,
  }: {
    header: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
          {header}
        </div>

        {/* Main Content — narrow on mobile, wide on desktop for grid layout */}
        <main className="flex-1 w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-5 sm:py-6">
          {children}
        </main>

        {/* Sticky Footer */}
        {footer && (
          <div className="sticky bottom-0 z-20 border-t border-slate-200/80 bg-white/90 backdrop-blur-xl p-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] pb-safe flex justify-center">
            <div className="w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl">
              {footer}
            </div>
          </div>
        )}
      </div>
    );
  }