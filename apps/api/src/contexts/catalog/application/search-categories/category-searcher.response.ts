export interface CategoryResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface CategorySearcherResponse {
  categories: CategoryResponse[];
}
