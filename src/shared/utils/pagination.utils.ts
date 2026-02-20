/**
 * Pagination header utilities used by project listing endpoints.
 *
 * Sets the standard `X-Page`, `X-Per-Page`, `X-Total`, `X-Total-Pages`,
 * `X-Prev-Page`, `X-Next-Page`, and `Link` headers used by platform UI clients.
 */
import { Request, Response } from 'express';
import * as qs from 'qs';

/**
 * Builds an absolute page URL by merging current query params with `page`.
 */
function getProjectPageLink(req: Request, page: number): string {
  const query = {
    ...req.query,
    page,
  };

  return `${req.protocol}://${req.get('Host')}${req.baseUrl}${req.path}?${qs.stringify(query)}`;
}

/**
 * Sets project pagination headers on the response.
 *
 * @param req Current Express request used for URL generation.
 * @param res Express response that receives pagination headers.
 * @param page Current page number.
 * @param perPage Number of records per page.
 * @param total Total record count.
 *
 * `Access-Control-Expose-Headers` is appended (not replaced) to preserve
 * existing CORS exposure headers.
 */
export function setProjectPaginationHeaders(
  req: Request,
  res: Response,
  page: number,
  perPage: number,
  total: number,
): void {
  const totalPages = Math.ceil(total / perPage);

  if (page > 1) {
    res.header('X-Prev-Page', String(page - 1));
  }

  if (page < totalPages) {
    res.header('X-Next-Page', String(page + 1));
  }

  res.header('X-Page', String(page));
  res.header('X-Per-Page', String(perPage));
  res.header('X-Total', String(total));
  res.header('X-Total-Pages', String(totalPages));

  if (totalPages > 0) {
    let link = `<${getProjectPageLink(req, 1)}>; rel="first", <${getProjectPageLink(req, totalPages)}>; rel="last"`;

    if (page > 1) {
      link += `, <${getProjectPageLink(req, page - 1)}>; rel="prev"`;
    }

    if (page < totalPages) {
      link += `, <${getProjectPageLink(req, page + 1)}>; rel="next"`;
    }

    res.header('Link', link);
  }

  let exposeHeaders =
    (res.getHeader('Access-Control-Expose-Headers') as string) || '';

  exposeHeaders += exposeHeaders ? ', ' : '';
  exposeHeaders +=
    'X-Page, X-Per-Page, X-Total, X-Total-Pages, X-Prev-Page, X-Next-Page, Link';

  res.header('Access-Control-Expose-Headers', exposeHeaders);
}

/**
 * Deprecated alias for `setProjectPaginationHeaders`.
 *
 * @deprecated Use `setProjectPaginationHeaders` directly.
 * @todo Remove this alias after all call sites are migrated.
 */
export const setResHeader = setProjectPaginationHeaders;
