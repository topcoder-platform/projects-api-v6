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

@Injectable()
export class FileService {
  private readonly logger = LoggerService.forRoot('FileService');
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({});
  }

  async getPresignedDownloadUrl(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: APP_CONFIG.presignedUrlExpiration,
    });
  }

  async transferFile(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
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

  async deleteFile(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.client.send(command);
  }
}
