# Revisión acotada: Reportes y Acceso

**Fecha:** 19-sep-2026 · **Estado:** 🔶 auditoría parcial, **no revisión completa**
([README](../README.md))

---

## Qué alcance tuvo esto, y qué no

Los cinco módulos anteriores —Catálogo, Inventario, Compras, Ventas y Cuentas por cobrar— tuvieron
la revisión completa del método: mapa del código, lectura del sistema de referencia, matriz
comparativa, hallazgos reproducidos uno a uno y revisión adversarial de lo construido.

**Reportes y Acceso no.** Lo que recibieron fue una **auditoría dirigida** a dos preguntas
concretas, las que esta tanda había demostrado que rinden:

1. ¿Alguna ruta responde distinto que sus gemelas a la misma entrada?
2. ¿Alguna cifra se calcula en más de un sitio, y dicen lo mismo?

Se dice aquí porque **dar un módulo por revisado sin haberlo revisado es peor que dejarlo en
blanco**: la próxima persona confiaría en un ✅ que nadie se ganó.

## Lo que sí se comprobó, y su resultado

### El barrido de identificadores inválidos (encontró dos defectos)

Catorce rutas del sistema aceptan un identificador. Con la misma entrada inválida, tres devolvían
un error interno; **una de ellas era de Reportes**:

```
500  /reports/inventory-valuation?warehouseId=undefined
```

Construido y con prueba, junto con los otros dos, en
[cuentas-por-cobrar.md § C1](../cuentas-por-cobrar/cuentas-por-cobrar.md).

### Las cifras que aparecen en más de un sitio (todas coinciden)

Es el patrón que en Ventas destapó el defecto grave del reservado, así que se buscó a propósito:

| Cifra | Dónde se calcula | ¿Coinciden? |
|---|---|---|
| Valor del inventario | Tablero · Informe de valuación | Sí, 304 en los dos |
| Saldo por cobrar | Tablero · Cuentas por cobrar · Informe de antigüedad | Sí, 39,60 en los tres |
| Antigüedad por tramos | Cuentas por cobrar · Reportes · Estado de cuenta | Sí, **incluso con una factura de 126 días de mora**, que es el caso que los habría separado |
| Vencido | Tablero · Cuentas por cobrar | Sí |

**No se dio por bueno porque coincidieran con los datos de la demostración.** Para la antigüedad se
montó el caso duro y los tres siguieron coincidiendo.

### El documento de la demostración que no se podía anular (defecto encontrado)

Se comprobó que un documento anulado desaparece de las cifras del tablero. El cobro sí:
anularlo baja «cobrado este mes» de 30 a 0 y sube el saldo por cobrar de 39,60 a 69,60.

Al intentar lo mismo con la factura, **apareció otra cosa**:

```
PUT /sales/invoices/{FAC000001}/cancel  -> 400 EmptyStringValueError
     registro: "SalesOrderLineId cannot be empty"
```

**Y sólo le pasa a la factura de la demostración.** Una creada por la API —pedido, despacho,
factura— se anula sin problema (`200`). La diferencia está en la base:

```sql
select code, order_line_id is null from invoice_lines … where code = 'FAC000001';
FAC000001 | t      <-- sin la línea de pedido que factura
```

La semilla escribe las líneas de factura **con Prisma directo**, saltándose el dominio, y no
guardaba `order_line_id`. Sin él, anular no tiene a dónde devolver lo facturado.

**Es exactamente lo que el método avisa**: *los datos de ejemplo suelen documentar el defecto*.
Aquí documentaban un estado que el sistema **no puede producir por sí mismo** — y cualquiera que
abriera la demostración e intentara anular esa factura se habría topado con un error que no
explica nada.

**Corregido en la semilla**, en las dos empresas.

### Los listados de Acceso

```
/users        3 filas      /roles   2 filas      /permissions   89 filas
```

Ninguno pagina. **Se deja así, con el porqué:** los permisos son un catálogo cerrado que el
sistema define —89 y sólo cambian al construir una función nueva—, y los roles son pocos por
diseño. El único que crece con el uso es el de usuarios, y crece despacio. Paginar los tres ahora
sería aplicar una receta sin la necesidad que la justifica, que es justo lo que este proyecto
decidió no hacer con los campos de la bodega y con el tipo «no inventariado».

## Lo que NO se miró, y habría que mirar

- **El tablero**: de dónde sale cada cifra, qué periodo cubre («este mes» contra qué zona horaria),
  y si un documento anulado desaparece de él.
- **Roles y permisos**: qué pasa con las personas que tienen un rol cuando ese rol pierde un
  permiso, y si un rol se puede dejar sin ninguno.
- **La sesión**: caducidad, renovación y cierre en todos los dispositivos.
- **Las exportaciones** (PDF y Excel): si usan el mismo cálculo que la pantalla. Ya se sabe que
  pasan por el mismo modelo de lectura, pero no se comprobó cifra a cifra.
- **El sistema de referencia**: no se leyó para ninguno de los dos módulos.
