import { Global, Module } from '@nestjs/common';
import { FraudGateway } from './fraud-gateway.service';
import { HeuristicScorer } from './heuristic-scorer';
import { StubScorer } from './stub-scorer';
import { SCORER } from './scorer.interface';

/**
 * Phase 1 binds SCORER -> HeuristicScorer so risk flows are demonstrable.
 * To match the spec's pure stub, swap the useClass to StubScorer.
 * Phase 2: useClass -> HttpScorer (FastAPI). No call sites change.
 */
@Global()
@Module({
  providers: [
    FraudGateway,
    StubScorer,
    HeuristicScorer,
    { provide: SCORER, useExisting: HeuristicScorer },
  ],
  exports: [FraudGateway],
})
export class FraudModule {}
