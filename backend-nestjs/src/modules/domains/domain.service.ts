import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEntity } from './domain.entity';
import { CreateDomainDto } from './dto/create-domain.dto';

@Injectable()
export class DomainService {
  constructor(
    @InjectRepository(DomainEntity)
    private readonly domainRepository: Repository<DomainEntity>,
  ) {}

  async list(): Promise<DomainEntity[]> {
    return this.domainRepository.find({
      order: {
        updatedAt: 'DESC',
      },
    });
  }

  async getByCode(domainCode: string): Promise<DomainEntity> {
    const domain = await this.domainRepository.findOne({
      where: {
        domainCode,
      },
    });

    if (!domain) {
      throw new NotFoundException(`Domain '${domainCode}' not found.`);
    }

    return domain;
  }

  async create(payload: CreateDomainDto): Promise<DomainEntity> {
    const entity = this.domainRepository.create(payload);
    return this.domainRepository.save(entity);
  }

  async updateByCode(domainCode: string, payload: CreateDomainDto): Promise<DomainEntity> {
    const current = await this.getByCode(domainCode);
    const next = this.domainRepository.merge(current, payload, {
      domainCode: payload.domainCode || domainCode,
    });
    return this.domainRepository.save(next);
  }

  async deleteByCode(domainCode: string): Promise<void> {
    const current = await this.getByCode(domainCode);
    await this.domainRepository.remove(current);
  }
}
