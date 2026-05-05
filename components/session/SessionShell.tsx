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
        <div className="border-b border-slate-200 bg-white">
          {header}
        </div>

        {/* Main Content — narrow on mobile, wide on desktop for grid layout */}
        <main className="flex-1 w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto px-5 py-6 sm:py-8">
          {children}
        </main>

        {/* Sticky Footer */}
        {footer && (
          <div data-onboarding="bottom-bar" className="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-5 shadow-[0_-8px_32px_rgba(15,23,42,0.08)] pb-safe flex justify-center">
            <div className="w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl">
              {footer}
            </div>
          </div>
        )}
      </div>
    );
  }