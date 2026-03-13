import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolDefinitionEntity } from './tool-definition.entity';
import { ToolDefinitionsController } from './tool-definitions.controller';
import { ToolDefinitionsService } from './tool-definitions.service';

@Module({
  imports: [TypeOrmModule.forFeature([ToolDefinitionEntity])],
  controllers: [ToolDefinitionsController],
  providers: [ToolDefinitionsService],
  exports: [ToolDefinitionsService],
})
export class ToolDefinitionsModule {}
