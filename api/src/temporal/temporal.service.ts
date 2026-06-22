import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';

export interface TranscodeWorkflowInput {
  schemaVersion: string;
  jobId: string;
  assetId: string;
  correlationId: string;
  inputKey: string;
  title: string;
  requestedAt: string;
}

// Task queue and workflow type — must match Go worker registrations.
const TASK_QUEUE = 'transcode';
const WORKFLOW_TYPE = 'TranscodeWorkflow';

@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemporalService.name);
  private client: Client | null = null;

  async onModuleInit(): Promise<void> {
    const address = process.env.TEMPORAL_ADDR ?? 'localhost:7233';
    try {
      const connection = await Connection.connect({ address });
      this.client = new Client({ connection });
      this.logger.log(`Connected to Temporal at ${address}`);
    } catch (err: unknown) {
      // Temporal may not be up at deploy time in all environments;
      // log a warning but let the process start — requests will fail fast
      // via ServiceUnavailableException until connectivity is restored.
      this.logger.warn(`Temporal not reachable at startup (${address}): ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.connection.close();
      this.client = null;
    }
  }

  // workflowId is deterministic so duplicate /complete calls hit the already-running
  // workflow instead of spawning a second one (Temporal deduplication).
  async startTranscodeWorkflow(input: TranscodeWorkflowInput): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Temporal client is not connected; cannot start TranscodeWorkflow',
      );
    }

    const workflowId = `transcode-${input.assetId}`;

    await this.client.workflow.start(WORKFLOW_TYPE, {
      taskQueue: TASK_QUEUE,
      workflowId,
      args: [input],
    });

    return workflowId;
  }
}
