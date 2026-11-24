import type { ReactNode } from "react";
import { ViewIcon } from "./ViewIcon";
import type { DashboardTile } from "./sheetTypes";

export interface DashboardProps {
  tiles: DashboardTile[];
  error: string | null;
  loading: boolean;
  onSelectTile: (tile: DashboardTile) => void;
  onEditTile: (tile: DashboardTile) => void;
  onRemoveView?: (viewId: string) => void;
  onClose: () => void;
  children?: ReactNode;
}

/** Full-screen grid. It is a page takeover, not a side drawer. */
export function Dashboard({
  tiles,
  error,
  loading,
  onSelectTile,
  onEditTile,
  onRemoveView,
  onClose,
  children,
}: DashboardProps) {
  return (
    <section className="dashboard" aria-label="Dashboard">
      <header className="dashboard-header">
        <div>
          <p className="mark">Dashboard</p>
          <h1>Everything</h1>
        </div>
        <button
          type="button"
          className="dashboard-close"
          aria-label="Close dashboard"
          onClick={onClose}
        >
          <ViewIcon name="x" size={20} />
        </button>
      </header>

      {error ? (
        <p className="error dashboard-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="status">Loading dashboard…</p> : null}

      <div className="dashboard-grid">
        {tiles.map((tile) => {
          const viewId = tile.viewId;
          return (
          <article
            key={tile.id}
            className={`dashboard-tile ${tile.isAddTile ? "add-tile" : ""}`}
          >
            <button
              type="button"
              className="tile-main"
              onClick={() => onSelectTile(tile)}
            >
              <span className={`tile-icon color-${tile.color}`}>
                <ViewIcon name={tile.icon} size={24} />
              </span>
              <span className="tile-title">{tile.title}</span>
              <span className="tile-kind">{tile.kind}</span>
            </button>
            {!tile.isAddTile ? (
              <span className="tile-tools">
                <button
                  type="button"
                  className="tile-edit"
                  aria-label={`Edit ${tile.title}`}
                  onClick={() => onEditTile(tile)}
                >
                  Edit
                </button>
                {tile.kind === "view" && viewId && onRemoveView ? (
                  <button
                    type="button"
                    className="tile-remove"
                    aria-label={`Remove ${tile.title}`}
                    onClick={() => onRemoveView(viewId)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ) : null}
          </article>
          );
        })}
      </div>
      {children}
    </section>
  );
}
