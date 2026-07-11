export function StartScreen({ onCreateOnline }: {
  onCreateOnline?: (() => void) | undefined;
}) {
  return (
    <div className="start-screen">
      <h1>Patient Pilgrims</h1>
      {onCreateOnline && (
        <>
          <button className="btn-primary" onClick={onCreateOnline}>New online game</button>
          <button onClick={() => { location.hash = "#/join"; }}>Join online game</button>
        </>
      )}
      <button onClick={() => { location.hash = "#/hotseat"; }}>Hotseat game</button>
    </div>
  );
}
