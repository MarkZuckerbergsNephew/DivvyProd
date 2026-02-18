export default async function JoinPage({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) {
    const { id } = await params;
  
    return (
      <div className="p-10 text-2xl">
        Join Session: {id}
      </div>
    );
  }
  