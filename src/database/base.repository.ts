import { Injectable } from '@nestjs/common';
import {
  Repository,
  FindOptionsWhere,
  DeepPartial,
  ObjectLiteral,
} from 'typeorm';
import { IRepository } from './interfaces/repository.interface';

@Injectable()
export abstract class BaseRepository<
  T extends ObjectLiteral,
> implements IRepository<T> {
  constructor(protected readonly repository: Repository<T>) {}

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async findById(id: string | number): Promise<T | null> {
    return await this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  async findOne(filter: FindOptionsWhere<T>): Promise<T | null> {
    return await this.repository.findOne({ where: filter });
  }

  async findAll(filter?: FindOptionsWhere<T>): Promise<T[]> {
    if (filter) {
      return await this.repository.find({ where: filter });
    }
    return await this.repository.find();
  }

  async update(id: string | number, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, data as any);
    return await this.findById(id);
  }

  async delete(id: string | number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
