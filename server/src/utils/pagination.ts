export interface PaginationMeta {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export const getPagination = (
  pageValue: unknown,
  limitValue: unknown,
  defaultLimit = 12,
) => {
  const parsedPage = Number(pageValue);
  const parsedLimit = Number(limitValue);

  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 50)
      : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const createPaginationMeta = (
  page: number,
  limit: number,
  totalItems: number,
): PaginationMeta => ({
  currentPage: page,
  limit,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / limit)),
});
