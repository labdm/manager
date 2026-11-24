import type { ReactNode, MouseEvent } from "react";

/**
 * One overlay for every write. At >=800px it is a centered dialog; below that
 * it is a fixed bottom sheet. The board underneath never changes width.
 */
export function Sheet({
  titleId,
  title,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  function onBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="sheet-backdrop" onMouseDown={onBackdrop}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="sheet-close"
            aria-label="Close sheet"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
