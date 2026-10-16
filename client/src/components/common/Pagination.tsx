import "./Pagination.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return totalItems !== undefined ? <p className="pagination-count">{totalItems} record{totalItems === 1 ? "" : "s"}</p> : null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1,
  );
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">Previous</button>
      {pages.map((page, index) => (
        <span key={page} className="pagination-page-wrap">
          {index > 0 && page - pages[index - 1] > 1 ? <span className="pagination-ellipsis">…</span> : null}
          <button type="button" className={page === currentPage ? "active" : ""} onClick={() => onPageChange(page)} aria-current={page === currentPage ? "page" : undefined}>{page}</button>
        </span>
      ))}
      <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">Next</button>
    </nav>
  );
}
