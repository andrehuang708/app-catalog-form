import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import {
  DataTable,
  type DataTableColumn,
} from "../src/components/admin/DataTable";

type Row = { id: string; name: string };

const columns: Array<DataTableColumn<Row>> = [
  { id: "name", header: "Name", accessor: (row) => row.name },
];

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: `row-${String(index).padStart(2, "0")}`,
  }));

const renderTable = (rows: Row[]) =>
  renderToString(
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      searchPlaceholder="Search rows…"
    />,
  );

const buttonTag = (html: string, label: string) =>
  html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ??
  "";

/** React SSR separates text nodes with comments: "Page <!-- -->1". */
const withoutSsrComments = (html: string) => html.replaceAll("<!-- -->", "");

describe("admin data table pagination", () => {
  const html = renderTable(makeRows(25));

  it("renders only the first page of rows", () => {
    expect(html).toContain("row-00");
    expect(html).toContain("row-09");
    expect(html).not.toContain("row-10");
    expect(html).not.toContain("row-24");
  });

  it("shows the row range and page controls", () => {
    expect(html).toContain("1–10 of 25 rows");
    expect(withoutSsrComments(html)).toContain("Page 1 of 3");
  });

  it("disables Previous on the first page and enables Next", () => {
    // Match the boolean attribute itself — the class names also contain
    // “disabled:” utility variants.
    expect(buttonTag(html, "Previous page")).toContain('disabled=""');
    expect(buttonTag(html, "Next page")).not.toContain('disabled=""');
  });
});

describe("admin data table with few rows", () => {
  const html = renderTable(makeRows(3));

  it("hides pagination when everything fits on one page", () => {
    expect(html).toContain("3 rows");
    expect(html).not.toContain("Page 1 of");
    expect(html).not.toContain('aria-label="Previous page"');
    expect(html).not.toContain('aria-label="Next page"');
  });

  it("renders every row", () => {
    expect(html).toContain("row-00");
    expect(html).toContain("row-02");
  });
});
