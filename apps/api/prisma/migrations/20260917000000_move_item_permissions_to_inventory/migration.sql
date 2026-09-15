-- Los articulos pasan del catalogo al inventario, y sus permisos con ellos. Renombrar un permiso
-- no puede quitarselo a quien ya lo tenia: primero se crea el codigo nuevo, luego cada rol recibe
-- el nuevo por cada viejo, y al final se borran los viejos (sus concesiones caen en cascada).
INSERT INTO "permissions" ("code", "description")
SELECT replace("code", 'catalog.items.', 'inventory.items.'), "description"
FROM "permissions"
WHERE "code" LIKE 'catalog.items.%'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "role_id", replace("permission_code", 'catalog.items.', 'inventory.items.')
FROM "role_permissions"
WHERE "permission_code" LIKE 'catalog.items.%'
ON CONFLICT DO NOTHING;

DELETE FROM "permissions" WHERE "code" LIKE 'catalog.items.%';
