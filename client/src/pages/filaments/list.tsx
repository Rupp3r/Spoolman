import { EditOutlined, EyeOutlined, FileOutlined, FilterOutlined, PlusSquareOutlined } from "@ant-design/icons";
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
    FilteredQueryColumn,
    NumberColumn,
    RichColumn,
    SortedColumn,
    SpoolIconColumn,
} from "../../components/column";
import { ColumnEditorModal } from "../../components/columnEditor";
import { useLiveify } from "../../components/liveify";
import {
    useSpoolmanArticleNumbers,
    useSpoolmanFilamentNames,
    useSpoolmanMaterials,
    useSpoolmanVendors,
} from "../../components/otherModels";
import { removeUndefined } from "../../utils/filtering";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { TableState, useInitialTableState, useStoreInitialState } from "../../utils/saveload";
import { useCurrencyFormatter } from "../../utils/settings";
import { IFilament } from "./model";

dayjs.extend(utc);

interface IFilamentCollapsed extends Omit<IFilament, "vendor"> {
  "vendor.name": string | null;
}

function collapseFilament(element: IFilament): IFilamentCollapsed {
  let vendor_name: string | null;
  if (element.vendor) {
    vendor_name = element.vendor.name;
  } else {
    vendor_name = null;
  }
  return { ...element, "vendor.name": vendor_name };
}

function translateColumnI18nKey(columnName: string): string {
  columnName = columnName.replace(".", "_");
  return `filament.fields.${columnName}`;
}

const namespace = "filamentList-v2";

const allColumns: (keyof IFilamentCollapsed & string)[] = [
  "id",
  "vendor.name",
  "name",
  "material",
  "price",
  "density",
  "diameter",
  "weight",
  "spool_weight",
  "article_number",
  "settings_extruder_temp",
  "settings_bed_temp",
  "registered",
  "comment",
];
const defaultColumns = allColumns.filter(
  (column_id) => ["registered", "density", "diameter", "spool_weight"].indexOf(column_id) === -1
);

export const FilamentList: React.FC<IResourceComponentsProps> = () => {
  const t = useTranslate();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const extraFields = useGetFields(EntityType.filament);
  const currencyFormatter = useCurrencyFormatter();

  const allColumnsWithExtraFields = useMemo(
    () => [...allColumns, ...(extraFields.data?.map((field) => "extra." + field.key) ?? [])],
    [extraFields.data]
  );

  // Load initial state
  const initialState = useInitialTableState(namespace);

  // Fetch data from the API
  // To provide the live updates, we use a custom solution (useLiveify) instead of the built-in refine "liveMode" feature.
  // This is because the built-in feature does not call the liveProvider subscriber with a list of IDs, but instead
  // calls it with a list of filters, sorters, etc. This means the server-side has to support this, which is quite hard.
  const { tableProps, sorters, setSorters, filters, setFilters, current, pageSize, setCurrent } =
    useTable<IFilamentCollapsed>({
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
            resource: "filament",
            invalidates: ["list"],
          });
        }
      },
      queryOptions: {
        select(data) {
          return {
            total: data.total,
            data: data.data.map(collapseFilament),
          };
        },
      },
    });

  // Create state for the columns to show
  const [showColumns, setShowColumns] = useState<string[]>(initialState.showColumns ?? defaultColumns);
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
  const queryDataSource: IFilamentCollapsed[] = useMemo(
    () => (tableProps.dataSource || []).map((record) => ({ ...record })),
    [tableProps.dataSource]
  );
  const dataSource = useLiveify("filament", queryDataSource, collapseFilament);

  if (tableProps.pagination) {
    tableProps.pagination.showSizeChanger = true;
  }

  const { editUrl, showUrl, cloneUrl } = useNavigation();
  const filamentAddSpoolUrl = (id: number): string => `/spool/create?filament_id=${id}`;
  const actions = (record: IFilamentCollapsed) => [
    { name: t("buttons.show"), icon: <EyeOutlined />, link: showUrl("filament", record.id) },
    { name: t("buttons.edit"), icon: <EditOutlined />, link: editUrl("filament", record.id) },
    { name: t("buttons.clone"), icon: <PlusSquareOutlined />, link: cloneUrl("filament", record.id) },
    { name: t("filament.buttons.add_spool"), icon: <FileOutlined />, link: filamentAddSpoolUrl(record.id) },
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
          label: t(translateColumnI18nKey(column_id)),
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

  const getColumnKey = (column: ColumnType<IFilamentCollapsed>): string | undefined => {
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
      i18ncat: "filament",
      width: 70,
    }),
    FilteredQueryColumn({
      ...commonProps,
      id: "vendor.name",
      i18nkey: "filament.fields.vendor_name",
      filterValueQuery: useSpoolmanVendors(),
    }),
    SpoolIconColumn({
      ...commonProps,
      id: "name",
      i18ncat: "filament",
      color: (record: IFilamentCollapsed) =>
        record.multi_color_hexes
          ? {
              colors: record.multi_color_hexes.split(","),
              vertical: record.multi_color_direction === "longitudinal",
            }
          : record.color_hex,
      filterValueQuery: useSpoolmanFilamentNames(),
    }),
    FilteredQueryColumn({
      ...commonProps,
      id: "material",
      i18ncat: "filament",
      filterValueQuery: useSpoolmanMaterials(),
      width: 110,
    }),
    SortedColumn({
      ...commonProps,
      id: "price",
      i18ncat: "filament",
      align: "right",
      width: 80,
      render: (_, obj: IFilamentCollapsed) => {
        if (obj.price === undefined) {
          return "";
        }
        return currencyFormatter.format(obj.price);
      },
    }),
    NumberColumn({
      ...commonProps,
      id: "density",
      i18ncat: "filament",
      unit: "g/cm³",
      maxDecimals: 2,
      width: 100,
    }),
    NumberColumn({
      ...commonProps,
      id: "diameter",
      i18ncat: "filament",
      unit: "mm",
      maxDecimals: 2,
      width: 100,
    }),
    NumberColumn({
      ...commonProps,
      id: "weight",
      i18ncat: "filament",
      unit: "g",
      maxDecimals: 0,
      width: 100,
    }),
    NumberColumn({
      ...commonProps,
      id: "spool_weight",
      i18ncat: "filament",
      unit: "g",
      maxDecimals: 0,
      width: 100,
    }),
    FilteredQueryColumn({
      ...commonProps,
      id: "article_number",
      i18ncat: "filament",
      filterValueQuery: useSpoolmanArticleNumbers(),
      width: 130,
    }),
    NumberColumn({
      ...commonProps,
      id: "settings_extruder_temp",
      i18ncat: "filament",
      unit: "°C",
      maxDecimals: 0,
      width: 100,
    }),
    NumberColumn({
      ...commonProps,
      id: "settings_bed_temp",
      i18ncat: "filament",
      unit: "°C",
      maxDecimals: 0,
      width: 100,
    }),
    DateColumn({
      ...commonProps,
      id: "registered",
      i18ncat: "filament",
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
      i18ncat: "filament",
      width: 150,
    }),
    ActionsColumn(t("table.actions"), actions),
  ]) as ColumnType<IFilamentCollapsed>[];

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
    .filter(Boolean) as ColumnType<IFilamentCollapsed>[];
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
      <Table<IFilamentCollapsed>
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

export default FilamentList;
