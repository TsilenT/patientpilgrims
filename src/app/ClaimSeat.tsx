import { useEffect, useState } from "react";
import { claimSeat } from "../net/game";

export function ClaimSeat({ id, seat, token, onClaimed }: {
  id: string; seat: number; token: string; onClaimed: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    claimSeat(id, seat, token)
      .then(() => onClaimed(id))
      .catch((e) => setError(e instanceof Error ? e.message : "This invite link is invalid."));
  }, [id, seat, token, onClaimed]);

  return (
    <main data-testid="app-root">
      <div className="start-screen">
        <h1>Joining game…</h1>
        {error && <p role="alert">{error}</p>}
      </div>
    </main>
  );
}
