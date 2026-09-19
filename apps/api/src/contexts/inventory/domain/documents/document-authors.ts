import { TenantId } from '../shared/tenant-id.vo.js';

export const DOCUMENT_AUTHORS = Symbol('DocumentAuthors');

// Quien hizo cada cosa, por su nombre. El inventario no sabe de usuarios: solo guarda su
// identificador y pregunta aqui como se llaman para ensenarlo.
export interface DocumentAuthors {
  // Solo los que son de la empresa: el nombre de alguien de otra no se filtra por aqui.
  namesOf(tenantId: TenantId, userIds: string[]): Promise<Map<string, string>>;
}
