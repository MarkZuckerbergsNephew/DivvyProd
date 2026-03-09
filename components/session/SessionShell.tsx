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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_40%,_#f8fafc)] flex flex-col">
        {/* Header */}
        <div className="border-b border-white/60 bg-white/85 backdrop-blur-xl shadow-sm">
          {header}
        </div>
  
        {/* Main Content */}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
  
        {/* Sticky Footer */}
        {footer && (
          <div className="sticky bottom-0 z-20 border-t border-white/60 bg-white/90 backdrop-blur-xl p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.06)]">
            {footer}
          </div>
        )}
      </div>
    );
  }