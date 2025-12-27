import { HolderOutlined } from "@ant-design/icons";
import { Checkbox, InputNumber, Modal, Space, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const ITEM_TYPE = "COLUMN_EDITOR_ITEM";

export interface ColumnEditorColumn {
  id: string;
  label: string;
}

interface DragItem {
  id: string;
  index: number;
}

interface ColumnEditorModalProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnEditorColumn[];
  columnOrder: string[];
  showColumns: string[];
  columnWidths: Record<string, number>;
  title: string;
  applyLabel: string;
  onApply: (nextState: { columnOrder: string[]; showColumns: string[]; columnWidths: Record<string, number> }) => void;
}

const ColumnEditorRow: React.FC<{
  id: string;
  label: string;
  index: number;
  isVisible: boolean;
  width?: number;
  onToggle: (id: string) => void;
  onWidthChange: (id: string, width?: number) => void;
  moveColumn: (dragIndex: number, hoverIndex: number) => void;
}> = ({ id, label, index, isVisible, width, onToggle, onWidthChange, moveColumn }) => {
  const ref = useRef<HTMLDivElement>(null);

  const [, drop] = useDrop<DragItem>({
    accept: ITEM_TYPE,
    hover(item) {
      if (!ref.current || item.index === index) {
        return;
      }
      moveColumn(item.index, index);
      item.index = index;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid #f0f0f0",
        background: isDragging ? "#fafafa" : "#fff",
      }}
    >
      <HolderOutlined style={{ color: "#999", cursor: "grab" }} />
      <Checkbox checked={isVisible} onChange={() => onToggle(id)} />
      <Typography.Text style={{ flex: 1 }}>{label}</Typography.Text>
      <InputNumber
        min={60}
        placeholder="auto"
        value={width}
        onChange={(value) => onWidthChange(id, typeof value === "number" ? value : undefined)}
        size="small"
      />
    </div>
  );
};

export const ColumnEditorModal: React.FC<ColumnEditorModalProps> = ({
  open,
  onClose,
  columns,
  columnOrder,
  showColumns,
  columnWidths,
  title,
  description,
  resetWidthsLabel,
  applyLabel,
  onApply,
}) => {
  const [order, setOrder] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setOrder(columnOrder);
    setVisibleColumns(new Set(showColumns));
    setWidths(columnWidths);
  }, [open, columnOrder, showColumns, columnWidths]);

  const columnsById = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);

  const resolvedOrder = useMemo(() => {
    const known = order.filter((id) => columnsById.has(id));
    const missing = columns.filter((column) => !known.includes(column.id)).map((column) => column.id);
    return [...known, ...missing];
  }, [columns, columnsById, order]);

  const moveColumn = useCallback((dragIndex: number, hoverIndex: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(dragIndex, 1);
      next.splice(hoverIndex, 0, dragged);
      return next;
    });
  }, []);

  const toggleColumn = useCallback((id: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const updateWidth = useCallback((id: string, width?: number) => {
    setWidths((prev) => {
      const next = { ...prev };
      if (width === undefined) {
        delete next[id];
      } else {
        next[id] = width;
      }
      return next;
    });
  }, []);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={() =>
        onApply({
          columnOrder: resolvedOrder,
          showColumns: Array.from(visibleColumns),
          columnWidths: widths,
        })
      }
      okText={applyLabel}
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          Drag to reorder, toggle to hide, and set a fixed width.
        </Typography.Text>
        <DndProvider backend={HTML5Backend}>
          <Space direction="vertical" style={{ width: "100%" }}>
            {resolvedOrder.map((id, index) => {
              const column = columnsById.get(id);
              if (!column) {
                return null;
              }
              return (
                <ColumnEditorRow
                  key={id}
                  id={id}
                  label={column.label}
                  index={index}
                  isVisible={visibleColumns.has(id)}
                  width={widths[id]}
                  onToggle={toggleColumn}
                  onWidthChange={updateWidth}
                  moveColumn={moveColumn}
                />
              );
            })}
          </Space>
        </DndProvider>
      </Space>
    </Modal>
  );
};
