export default async function SummaryPage({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) {
    const { id } = await params;
  
    return (
      <div className="p-10 text-2xl">
        Summary for Session: {id}
      </div>
    );
  }
  