-- Allow read access to payments (e.g. for realtime and session payment lists)
create policy "allow read payments"
on payments
for select
using (true);
