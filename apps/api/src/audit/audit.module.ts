import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global: cualquier modulo que cambie algo debe poder dejar rastro. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
