import { useState } from "react";
import { extractJoinHash } from "./router";

export function JoinScreen() {
  const [code, setCode] = useState("");
  const joinHash = extractJoinHash(code);

  return (
    <div className="start-screen">
      <h1>Join online game</h1>
      <p className="join-hint">Paste a game code, invite link, or recovery link.</p>
      <form className="join-online" onSubmit={(e) => {
        e.preventDefault();
        if (joinHash !== null) location.hash = joinHash;
      }}>
        <input aria-label="Game code" placeholder="Game code, invite or recovery link"
          autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn-primary" type="submit" disabled={joinHash === null}>Join</button>
      </form>
      <button className="back-link" onClick={() => { location.hash = "#/"; }}>‹ Back to menu</button>
    </div>
  );
}
