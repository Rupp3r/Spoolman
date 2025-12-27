import { EditOutlined, EyeOutlined, FilterOutlined, PlusSquareOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { IResourceComponentsProps, useInvalidate, useNavigation, useTranslate } from "@refinedev/core";
import { Button, Table } from "antd";
import type { ColumnType } from "antd/es/table/interface";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
    ActionsColumn,
    CustomFieldColumn,
    DateColumn,
    NumberColumn,
    RichColumn,
    SortedColumn,
} from "../../components/column";
import { ColumnEditorModal } from "../../components/columnEditor";
import { useLiveify } from "../../components/liveify";
import { removeUndefined } from "../../utils/filtering";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { TableState, useInitialTableState, useStoreInitialState } from "../../utils/saveload";
import { IVendor } from "./model";

dayjs.extend(utc);

const namespace = "vendorList-v2";

const allColumns: (keyof IVendor & string)[] = ["id", "name", "registered", "comment", "empty_spool_weight"];

export const VendorList: React.FC<IResourceComponentsProps> = () => {
  const t = useTranslate();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const extraFields = useGetFields(EntityType.vendor);

  const allColumnsWithExtraFields = useMemo(
    () => [...allColumns, ...(extraFields.data?.map((field) => "extra." + field.key) ?? [])],
    [extraFields.data]
  );

  // Load initial state
  const initialState = useInitialTableState(namespace);

  // Fetch data from the API
  const { tableProps, sorters, setSorters, filters, setFilters, current, pageSize, setCurrent } = useTable<IVendor>({
    syncWithLocation: false,
    pagination: {
      mode: "server",
      current: initialState.pagination.current,
      pageSize: initialState.pagination.pageSize,
    },
    sorters: {
      mode: "server",
      initial: initialState.sorters,
    },
    filters: {
      mode: "server",
      initial: initialState.filters,
    },
    liveMode: "manual",
    onLiveEvent(event) {
      if (event.type === "created" || event.type === "deleted") {
        // updated is handled by the liveify
        invalidate({
          resource: "vendor",
          invalidates: ["list"],
        });
      }
    },
  });

  // Create state for the columns to show
  const [showColumns, setShowColumns] = useState<string[]>(initialState.showColumns ?? allColumns);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const savedOrder = initialState.columnOrder ?? allColumnsWithExtraFields;
    const known = new Set(allColumnsWithExtraFields);
    const filtered = savedOrder.filter((columnId) => known.has(columnId));
    const missing = allColumnsWithExtraFields.filter((columnId) => !filtered.includes(columnId));
    return [...filtered, ...missing];
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialState.columnWidths ?? {});
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);

  useEffect(() => {
    setColumnOrder((prev) => {
      const known = new Set(allColumnsWithExtraFields);
      const filtered = prev.filter((columnId) => known.has(columnId));
      const missing = allColumnsWithExtraFields.filter((columnId) => !filtered.includes(columnId));
      return [...filtered, ...missing];
    });
  }, [allColumnsWithExtraFields]);

  // Store state in local storage
  const tableState: TableState = {
    sorters,
    filters,
    pagination: { current, pageSize },
    showColumns,
    columnOrder,
    columnWidths,
  };
  useStoreInitialState(namespace, tableState);

  // Collapse the dataSource to a mutable list
  const queryDataSource: IVendor[] = useMemo(() => {
    return (tableProps.dataSource || []).map((record) => ({ ...record }));
  }, [tableProps.dataSource]);
  const dataSource = useLiveify(
    "vendor",
    queryDataSource,
    useCallback((record: IVendor) => record, [])
  );

  if (tableProps.pagination) {
    tableProps.pagination.showSizeChanger = true;
  }

  const { editUrl, showUrl, cloneUrl } = useNavigation();
  const actions = (record: IVendor) => [
    { name: t("buttons.show"), icon: <EyeOutlined />, link: showUrl("vendor", record.id) },
    { name: t("buttons.edit"), icon: <EditOutlined />, link: editUrl("vendor", record.id) },
    { name: t("buttons.clone"), icon: <PlusSquareOutlined />, link: cloneUrl("vendor", record.id) },
  ];

  const commonProps = {
    t,
    navigate,
    actions,
    dataSource,
    tableState,
    sorter: true,
  };

  const columnOptions = useMemo(
    () =>
      allColumnsWithExtraFields.map((column_id) => {
        if (column_id.indexOf("extra.") === 0) {
          const extraField = extraFields.data?.find((field) => "extra." + field.key === column_id);
          return {
            id: column_id,
            label: extraField?.name ?? column_id,
          };
        }

        return {
          id: column_id,
          label: t(`vendor.fields.${column_id}`),
        };
      }),
    [allColumnsWithExtraFields, extraFields.data, t]
  );

  const handleResizeStart = useCallback(
    (columnId: string) => (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const headerCell = (event.currentTarget as HTMLElement).closest("th");
      const startWidth =
        columnWidths[columnId] ?? (headerCell ? Math.round(headerCell.getBoundingClientRect().width) : 0);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const nextWidth = Math.max(60, startWidth + moveEvent.clientX - startX);
        setColumnWidths((prev) => ({
          ...prev,
          [columnId]: Math.round(nextWidth),
        }));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [columnWidths]
  );

  const getColumnKey = (column: ColumnType<IVendor>): string | undefined => {
    if (column.key) {
      return column.key.toString();
    }
    if (Array.isArray(column.dataIndex)) {
      return column.dataIndex.join(".");
    }
    if (typeof column.dataIndex === "string") {
      return column.dataIndex;
    }
    return undefined;
  };

  const baseColumns = removeUndefined([
    SortedColumn({
      ...commonProps,
      id: "id",
      i18ncat: "vendor",
      width: 70,
    }),
    SortedColumn({
      ...commonProps,
      id: "name",
      i18ncat: "vendor",
    }),
    DateColumn({
      ...commonProps,
      id: "registered",
      i18ncat: "vendor",
      width: 200,
    }),
    NumberColumn({
      ...commonProps,
      id: "empty_spool_weight",
      i18ncat: "vendor",
      unit: "g",
      maxDecimals: 0,
      width: 200,
    }),
    ...(extraFields.data?.map((field) => {
      return CustomFieldColumn({
        ...commonProps,
        field,
      });
    }) ?? []),
    RichColumn({
      ...commonProps,
      id: "comment",
      i18ncat: "vendor",
    }),
    ActionsColumn<IVendor>(t("table.actions"), actions),
  ]) as ColumnType<IVendor>[];

  const columnsWithResizers = baseColumns.map((column) => {
    const columnKey = getColumnKey(column);
    if (!columnKey || columnKey === "actions") {
      return column;
    }
    return {
      ...column,
      title: (
        <div className="spoolman-resizable-header">
          <span>{column.title}</span>
          <span className="spoolman-resizer" onMouseDown={handleResizeStart(columnKey)} />
        </div>
      ),
    };
  });

  const orderSet = new Set(columnOrder);
  const orderedColumns = columnOrder
    .map((columnId) => columnsWithResizers.find((column) => getColumnKey(column) === columnId))
    .filter(Boolean) as ColumnType<IVendor>[];
  const remainingColumns = columnsWithResizers.filter((column) => {
    const columnKey = getColumnKey(column);
    return !columnKey || !orderSet.has(columnKey);
  });
  const tableColumns = [...orderedColumns, ...remainingColumns];

  return (
    <List
      headerButtons={({ defaultButtons }) => (
        <>
          <Button
            type="primary"
            icon={<FilterOutlined />}
            onClick={() => {
              setFilters([], "replace");
              setSorters([{ field: "id", order: "asc" }]);
              setCurrent(1);
            }}
          >
            {t("buttons.clearFilters")}
          </Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditColumnsOpen(true)}>
            {t("buttons.hideColumns")}
          </Button>
          <ColumnEditorModal
            open={editColumnsOpen}
            onClose={() => setEditColumnsOpen(false)}
            columns={columnOptions}
            columnOrder={columnOrder}
            showColumns={showColumns}
            columnWidths={columnWidths}
            title={t("buttons.hideColumns")}
            applyLabel={t("buttons.save")}
            onApply={(nextState) => {
              setColumnOrder(nextState.columnOrder);
              setShowColumns(nextState.showColumns);
              setColumnWidths(nextState.columnWidths);
              setEditColumnsOpen(false);
            }}
          />
          {defaultButtons}
        </>
      )}
    >
      <Table
        {...tableProps}
        sticky
        tableLayout="auto"
        scroll={{ x: "max-content" }}
        dataSource={dataSource}
        rowKey="id"
        columns={tableColumns}
      />
    </List>
  );
};

export default VendorList;
