export function StartScreen({ onCreateOnline, lastOnlineGameId }: {
  onCreateOnline?: (() => void) | undefined;
  lastOnlineGameId: string | null;
}) {
  return (
    <div className="start-screen">
      <h1>Patient Pilgrims</h1>
      {onCreateOnline && (
        <>
          {lastOnlineGameId && (
            <button className="btn-primary" onClick={() => { location.hash = `#/g/${lastOnlineGameId}`; }}>
              Join last online game
            </button>
          )}
          <button className="btn-primary" onClick={onCreateOnline}>New online game</button>
          <button onClick={() => { location.hash = "#/join"; }}>Join online game</button>
        </>
      )}
      <button onClick={() => { location.hash = "#/hotseat"; }}>Hotseat game</button>
    </div>
  );
}
