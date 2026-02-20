import { calculateSettlement } from "../../../lib/calculateSettlement";
import { createVenmoLink } from "../../../lib/paymentLinks";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const settlements = await calculateSettlement(id);

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-6">
        Settlement Summary
      </h1>

      <ul className="bg-white rounded-xl shadow divide-y">
        {settlements.map(s => (
          <li
            key={s.participant_id}
            className="flex justify-between items-center px-4 py-4"
          >
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-500">
                owes ${s.owes.toFixed(2)}
              </p>
            </div>

            {s.venmo && (
              <a
                href={createVenmoLink(
                  s.venmo,
                  s.owes,
                  "Divvy Split"
                )}
                target="_blank"
                className="bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Pay Host
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
