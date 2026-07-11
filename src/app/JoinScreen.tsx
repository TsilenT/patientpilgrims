import { useState } from "react";
import { extractGameId } from "./router";

export function JoinScreen() {
  const [code, setCode] = useState("");
  const joinId = extractGameId(code);

  return (
    <div className="start-screen">
      <h1>Join online game</h1>
      <p className="join-hint">Paste the game code or invite link your host shared.</p>
      <form className="join-online" onSubmit={(e) => {
        e.preventDefault();
        if (joinId !== null) location.hash = `#/g/${joinId}`;
      }}>
        <input aria-label="Game code" placeholder="Game code or invite link"
          autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn-primary" type="submit" disabled={joinId === null}>Join</button>
      </form>
      <button className="back-link" onClick={() => { location.hash = "#/"; }}>‹ Back to menu</button>
    </div>
  );
}
