import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class CategoryId extends Uuid {
  static of(value: string): CategoryId {
    return new CategoryId(value);
  }
}
