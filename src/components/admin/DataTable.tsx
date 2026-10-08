import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

/** One column of a management table. */
export type DataTableColumn<T> = {
  /** Stable id — the key used when sorting. */
  id: string;
  header: string;
  /** Plain-text value used for search, sorting, and the default cell. */
  accessor: (row: T) => string | number;
  /** Richer cell content; falls back to the accessor value. */
  cell?: (row: T) => ReactNode;
  /** Secondary detail — hidden on small screens to keep tables readable. */
  secondary?: boolean;
  className?: string;
};

type SortDirection = "asc" | "desc";
type SortState = { id: string; direction: SortDirection } | null;

type Props<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Placeholder for the search box. */
  searchPlaceholder?: string;
  /** Extra controls beside the search box (e.g. an “Add” button). */
  toolbar?: ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
  initialSort?: SortState;
  /** Cap rendered rows after filtering (the dashboard’s “recent” list). */
  maxRows?: number;
};

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * The one table every admin page shares: free-text search across all
 * columns, click-to-sort headers, a loading skeleton, an empty state, and
 * horizontal overflow so it stays usable on narrow screens.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder = "Search…",
  toolbar,
  emptyMessage = "Nothing here yet.",
  isLoading = false,
  initialSort = null,
  maxRows,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(initialSort);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) =>
        String(column.accessor(row)).toLowerCase().includes(needle),
      ),
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((candidate) => candidate.id === sort.id);
    if (!column) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => factor * compare(column.accessor(a), column.accessor(b)),
    );
  }, [filtered, sort, columns]);

  const visible = maxRows ? sorted.slice(0, maxRows) : sorted;

  const toggleSort = (id: string) =>
    setSort((current) =>
      current?.id === id
        ? current.direction === "asc"
          ? { id, direction: "desc" }
          : null
        : { id, direction: "asc" },
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {toolbar}
      </div>

      <div className="border-border/70 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <TableHead
                    key={column.id}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "whitespace-nowrap",
                      column.secondary && "hidden md:table-cell",
                      column.className,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.id)}
                      className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                      title={`Sort by ${column.header}`}
                    >
                      {column.header}
                      {active ? (
                        sort.direction === "asc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUp className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.secondary && "hidden md:table-cell",
                        column.className,
                      )}
                    >
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center text-sm"
                >
                  {query.trim() ? "No rows match your search." : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.secondary && "hidden md:table-cell",
                        column.className,
                      )}
                    >
                      {column.cell
                        ? column.cell(row)
                        : String(column.accessor(row))}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && rows.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {filtered.length === rows.length
            ? `${rows.length} row${rows.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${rows.length} rows match “${query.trim()}”`}
        </p>
      )}
    </div>
  );
}
