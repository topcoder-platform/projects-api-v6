export class SearchResult<T> {
  total: number;
  page: number;
  perPage: number;
  data: T[];
}
