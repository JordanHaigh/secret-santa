export class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new RequestError(result.error ?? "Something went wrong. Please try again.", response.status);
  return result as T;
}
export function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase(); }
export function downloadCsv(name: string, rows: string[][]) {
  const csv = rows.map(row => row.map(cell => {
    // Prevent spreadsheet formula execution when opening user-provided text.
    const safe = /^[\s]*[=+\-@]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
