import React, { useState, useEffect } from 'react';

interface DynamicGridProps<T extends { id: string | number }> {
  items: T[];
  columns?: number;
  itemsPerPage?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  onPageChange?: (page: number) => void;
}

export function DynamicGrid<T extends { id: string | number }>({
  items,
  columns = 4,
  itemsPerPage = 12,
  renderItem,
  onPageChange,
}: DynamicGridProps<T>) {
  const [currentPage, setCurrentPage] = useState(0);
  const [responsiveColumns, setResponsiveColumns] = useState(columns);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 480) {
        setResponsiveColumns(1);
      } else if (window.innerWidth < 768) {
        setResponsiveColumns(2);
      } else if (window.innerWidth < 1024) {
        setResponsiveColumns(Math.min(columns, 3));
      } else {
        setResponsiveColumns(columns);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [columns]);

  // Reset to page 0 when item list changes
  useEffect(() => {
    setCurrentPage(0);
  }, [items.length]);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = currentPage * itemsPerPage;
  const paginatedItems = items.slice(startIdx, startIdx + itemsPerPage);

  const handlePreviousPage = () => {
    const newPage = Math.max(0, currentPage - 1);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  const handleNextPage = () => {
    const newPage = Math.min(totalPages - 1, currentPage + 1);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  return (
    <div className="dynamic-grid-container">
      <div
        className="dynamic-grid"
        style={{ gridTemplateColumns: `repeat(${responsiveColumns}, 1fr)` }}
      >
        {paginatedItems.map((item, idx) => (
          <React.Fragment key={item.id}>
            {renderItem(item, startIdx + idx)}
          </React.Fragment>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            disabled={currentPage === 0}
            onClick={handlePreviousPage}
            aria-label="Previous page"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {currentPage + 1} of {totalPages} ({items.length} total)
          </span>
          <button
            className="pagination-btn"
            disabled={currentPage === totalPages - 1}
            onClick={handleNextPage}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
