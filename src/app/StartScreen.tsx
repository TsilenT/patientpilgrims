import { useState } from "react";
import { extractGameId } from "./router";

export function StartScreen({ hasSave, onCreateOnline }: {
  hasSave: boolean;
  onCreateOnline?: (() => void) | undefined;
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const joinId = extractGameId(code);

  return (
    <div className="start-screen">
      <h1>Patient Pilgrims</h1>
      {onCreateOnline && (
        <>
          <button className="btn-primary" onClick={onCreateOnline}>New online game</button>
          <button aria-expanded={joinOpen} onClick={() => setJoinOpen((o) => !o)}>
            Join online game
          </button>
          {joinOpen && (
            <form className="join-online" onSubmit={(e) => {
              e.preventDefault();
              if (joinId !== null) location.hash = `#/g/${joinId}`;
            }}>
              <input aria-label="Game code" placeholder="Game code or invite link"
                autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn-primary" type="submit" disabled={joinId === null}>Join</button>
            </form>
          )}
        </>
      )}
      <button onClick={() => { location.hash = "#/hotseat"; }}>
        {hasSave ? "Resume hotseat game" : "New hotseat game"}
      </button>
    </div>
  );
}
