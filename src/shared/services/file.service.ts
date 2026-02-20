import { Injectable } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { APP_CONFIG } from 'src/shared/config/app.config';
import { LoggerService } from 'src/shared/modules/global/logger.service';

/**
 * S3 file-operation wrapper for project attachments.
 *
 * Provides presigned download URLs, server-side copy, and delete operations.
 *
 * Used by project-attachment flows and relies on ambient AWS credential chain
 * resolution (environment variables, IAM role, shared credentials).
 */
@Injectable()
export class FileService {
  private readonly logger = LoggerService.forRoot('FileService');
  private readonly client: S3Client;

  constructor() {
    // TODO: consider explicitly setting the AWS region via APP_CONFIG or env var to avoid region resolution failures.
    this.client = new S3Client({});
  }

  /**
   * Generates a presigned S3 download URL.
   *
   * URL expiry is `APP_CONFIG.presignedUrlExpiration` seconds (defaults to
   * 3600 seconds).
   *
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @returns presigned GET URL
   * @throws S3ServiceException when AWS SDK request signing fails
   */
  async getPresignedDownloadUrl(bucket: string, key: string): Promise<string> {
    // TODO: validate that bucket and key values are within expected prefixes before issuing S3 commands.
    // TODO: review whether 3600s expiry is appropriate for the attachment use case; consider a shorter window.
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: APP_CONFIG.presignedUrlExpiration,
    });
  }

  /**
   * Copies an S3 object server-side from source to destination.
   *
   * @param sourceBucket source bucket name
   * @param sourceKey source object key
   * @param destBucket destination bucket name
   * @param destKey destination object key
   * @returns resolved promise on successful copy
   * @throws S3ServiceException when the source object is missing or copy fails
   */
  async transferFile(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
    // TODO: validate that bucket and key values are within expected prefixes before issuing S3 commands.
    // TODO: consider wrapping S3 errors in a domain-specific exception for consistent error handling across the service.
    const command = new CopyObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      CopySource: `${sourceBucket}/${sourceKey}`,
    });

    await this.client.send(command);
    this.logger.debug(
      `Transferred file from ${sourceBucket}/${sourceKey} to ${destBucket}/${destKey}`,
    );
  }

  /**
   * Deletes an S3 object.
   *
   * S3 delete is idempotent and succeeds even when the key does not exist.
   *
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @returns resolved promise on successful delete request
   */
  async deleteFile(bucket: string, key: string): Promise<void> {
    // TODO: validate that bucket and key values are within expected prefixes before issuing S3 commands.
    // TODO: consider wrapping S3 errors in a domain-specific exception for consistent error handling across the service.
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.client.send(command);
  }
}
