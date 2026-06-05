import { useEffect } from "react";
export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (message === null) return;
    const id = setTimeout(onDismiss, 3000);
    return () => clearTimeout(id);
  }, [message, onDismiss]);
  if (message === null) return null;
  return <div role="alert" className="toast">{message}</div>;
}
