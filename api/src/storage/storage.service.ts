import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedPut {
  /** The pre-signed URL the client should PUT the file to. */
  url: string;
  /** UTC timestamp when the URL expires. */
  expiresAt: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  private readonly s3: S3Client;

  /**
   * Used only for generating pre-signed PUT URLs. Configured with the
   * publicly reachable endpoint (S3_PUBLIC_ENDPOINT) so the HMAC signature
   * in the URL matches what the browser actually sends to MinIO. Signing with
   * the internal Docker host (minio:9000) would cause MinIO to reject the
   * request because the Host in the signature wouldn't match.
   */
  private readonly presignS3: S3Client;

  private readonly bucket: string;

  constructor() {
    const internalEndpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT ?? internalEndpoint;
    const region = process.env.S3_REGION ?? 'us-east-1';
    this.bucket = process.env.S3_BUCKET ?? 'streamflix-media';

    const credentials = {
      accessKeyId: process.env.S3_KEY ?? 'minioadmin',
      secretAccessKey: process.env.S3_SECRET ?? 'minioadmin',
    };

    this.s3 = new S3Client({
      endpoint: internalEndpoint,
      region,
      credentials,
      forcePathStyle: true,
    });
    this.presignS3 = new S3Client({
      endpoint: publicEndpoint,
      region,
      credentials,
      forcePathStyle: true,
    });

    this.logger.log(
      `Storage ready — internal: ${internalEndpoint}, public: ${publicEndpoint}, bucket: ${this.bucket}`,
    );
  }

  /**
   * Set bucket CORS on startup so browsers can PUT pre-signed uploads
   * directly to MinIO from any origin. Runs once after the module is wired;
   * idempotent (PutBucketCors is a replace operation).
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.s3.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag', 'x-amz-request-id'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      this.logger.log('Bucket CORS policy set');
    } catch (err: unknown) {
      // Log but don't crash — if the bucket doesn't exist yet (minio-setup
      // hasn't run) this will fail; it will succeed on the next restart.
      this.logger.warn(`Failed to set bucket CORS: ${String(err)}`);
    }
  }

  async getPresignedPutUrl(
    key: string,
    contentType: string,
    ttlSeconds = 900,
  ): Promise<PresignedPut> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.presignS3, cmd, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { url, expiresAt };
  }

  async headObject(key: string): Promise<HeadObjectCommandOutput> {
    const cmd = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
    return this.s3.send(cmd);
  }

  rawKey(assetId: string, ext: string): string {
    return `raw/${assetId}/source.${ext}`;
  }
}
