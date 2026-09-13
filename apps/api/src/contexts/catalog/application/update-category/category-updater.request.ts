export interface CategoryUpdaterRequest {
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string | null;
}
