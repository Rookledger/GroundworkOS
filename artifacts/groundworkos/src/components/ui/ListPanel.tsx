import type { ReactNode } from "react";
import { Panel } from "./Panel";

interface ListPanelProps<T> {
  title: string;
  items: T[];
  emptyMessage: string;
  renderRow: (item: T, index: number, total: number) => ReactNode;
  className?: string;
}

export function ListPanel<T>({
  title,
  items,
  emptyMessage,
  renderRow,
  className,
}: ListPanelProps<T>) {
  return (
    <Panel title={title} badge={items.length} noPad className={className}>
      {items.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: "#a8a099" }}>
          {emptyMessage}
        </p>
      ) : (
        <div>{items.map((item, i) => renderRow(item, i, items.length))}</div>
      )}
    </Panel>
  );
}
