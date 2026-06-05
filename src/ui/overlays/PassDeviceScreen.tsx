export function PassDeviceScreen({ name, onReveal }: { name: string; onReveal: () => void }) {
  return (
    <div className="pass-device" role="dialog" aria-label="Pass the device">
      <p>Pass the device to <strong>{name}</strong></p>
      <button onClick={onReveal}>Reveal</button>
    </div>
  );
}
