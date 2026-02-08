import { Request, Response } from 'express';
import * as qs from 'qs';

function getProjectPageLink(req: Request, page: number): string {
  const query = {
    ...req.query,
    page,
  };

  return `${req.protocol}://${req.get('Host')}${req.baseUrl}${req.path}?${qs.stringify(query)}`;
}

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

export const setResHeader = setProjectPaginationHeaders;
