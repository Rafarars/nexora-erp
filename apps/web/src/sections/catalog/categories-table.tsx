'use client';

import { changeCategoryStatus, saveCategory } from '@/app/(app)/catalogo/actions';
import { Field, TextArea } from '@/sections/shared/field';
import type { Category } from '@/modules/catalog/domain/catalog';
import { CatalogTable } from './catalog-table';

export function CategoriesTable({
  categories,
  ...permissions
}: {
  categories: Category[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="category"
      title="Categorías"
      description="Agrupan los artículos. Una categoría con artículos activos no se puede desactivar."
      newLabel="Nueva categoría"
      rows={categories}
      columns={[
        { header: 'Nombre', cell: (category) => <span className="font-medium">{category.name}</span> },
        { header: 'Descripción', cell: (category) => <span className="text-muted">{category.description ?? '—'}</span> },
      ]}
      renderFields={(category) => (
        <>
          <Field label="Nombre" name="name" testId="category-name" defaultValue={category?.name} autoComplete="off" />
          <TextArea label="Descripción" name="description" testId="category-description" defaultValue={category?.description ?? ''} />
        </>
      )}
      save={saveCategory}
      changeStatus={changeCategoryStatus}
      {...permissions}
    />
  );
}
