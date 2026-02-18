export default async function SessionPage({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) {
    const { id } = await params;
  
    return (
      <div className="p-10 text-2xl">
        Session ID: {id}
      </div>
    );
  }
  