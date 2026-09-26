import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditPurgeService } from './audit-purge.service';
import { AuditQueryService } from './audit-query.service';
import { AuditService } from './audit.service';
import { SessionAuditService } from './session-audit.service';

/** Global: cualquier modulo que cambie algo debe poder dejar rastro. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditQueryService, AuditPurgeService, SessionAuditService],
  exports: [AuditService, AuditPurgeService, SessionAuditService],
})
export class AuditModule {}
