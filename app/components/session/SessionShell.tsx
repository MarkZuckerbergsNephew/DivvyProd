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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b z-10">
          {header}
        </div>
  
        {/* Main Content */}
        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-6">
          {children}
        </main>
  
        {/* Sticky Footer */}
        {footer && (
          <div className="sticky bottom-0 bg-white border-t p-4">
            {footer}
          </div>
        )}
      </div>
    );
  }