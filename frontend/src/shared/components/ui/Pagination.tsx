import { cn } from "../../utils/cn"

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const showEllipsis = totalPages > 7

    if (showEllipsis) {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push("...")
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push("...")
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push("...")
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push("...")
        pages.push(totalPages)
      }
    } else {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    }

    return pages
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          "w-16 h-10 rounded-md flex items-center justify-center text-sm font-medium transition-colors",
          currentPage === 1
            ? "text-brand-blue/30 cursor-not-allowed dark:text-slate-600"
            : "text-brand-blue hover:bg-brand-blue/10 dark:text-slate-200 dark:hover:bg-slate-800"
        )}
      >
        Previous
      </button>

      {getPageNumbers().map((page, index) =>
        typeof page === "number" ? (
          <button
            key={index}
            onClick={() => onPageChange(page)}
            className={cn(
              "w-10 h-10 rounded-md flex items-center justify-center text-sm font-medium transition-colors",
              currentPage === page
                ? "bg-brand-blue text-white dark:bg-brand-blue dark:hover:bg-brand-blue/80"
                : "text-brand-blue hover:bg-brand-blue/10 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            {page}
          </button>
        ) : (
          <span
            key={index}
            className="w-10 h-10 flex items-center justify-center text-brand-blue/50 dark:text-slate-400"
          >
            {page}
          </span>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          "w-10 h-10 rounded-md flex items-center justify-center text-sm font-medium transition-colors",
          currentPage === totalPages
            ? "text-brand-blue/30 cursor-not-allowed dark:text-slate-600"
            : "text-brand-blue hover:bg-brand-blue/10 dark:text-slate-200 dark:hover:bg-slate-800"
        )}
      >
        Next
      </button>
    </div>
  )
}
