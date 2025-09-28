/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as Path from 'path';
import { Request } from 'express';
import { JwtUser } from 'src/auth/auth.dto';
import { PrismaService } from 'src/shared/services/prisma.service';
import { EventBusService } from 'src/shared/services/event-bus.service';
import { UtilService } from 'src/shared/services/util.service';
import { PERMISSION } from 'src/auth/constants';
import { EVENT, RESOURCES, ATTACHMENT_TYPES } from 'src/shared/constants';
import Utils from 'src/shared/utils';
import {
  AttachmentResponseDto,
  CreateAttachmentDto,
  UpdateAttachmentDto,
} from './project-attachment.dto';
import {
  includes,
  assign,
  cloneDeep,
  filter,
  isEmpty,
  join,
  omit,
} from 'lodash';
import { AppConfig } from 'config/config';

/**
 * Service class for handling project attachment operations.
 * Provides methods for creating, retrieving, updating, and deleting project attachments.
 */
@Injectable()
export class ProjectAttachmentService {
  private readonly logger = new Logger(ProjectAttachmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly utilService: UtilService,
  ) {}

  /**
   * Creates a new attachment for a project.
   * @param req - The request
   * @param projectId - ID of the project to attach to
   * @param dto - Data transfer object containing attachment details
   * @returns Promise resolving to the created attachment response
   */
  async createAttachment(
    req: Request,
    projectId: number,
    dto: CreateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    const allowedUsers = dto.allowedUsers || undefined;

    const authUser = req['authUser'] as JwtUser;
    const authUserId = Number(authUser.userId);

    // extract file name
    const fileName = Path.parse(dto.path).base;
    // create file path
    const path = join(
      [
        AppConfig.projectAttachmentPathPrefix,
        projectId,
        AppConfig.projectAttachmentPathSuffix,
        fileName,
      ],
      '/',
    );

    const attachmentBody = {
      projectId,
      allowedUsers,
      createdBy: authUserId,
      updatedBy: authUserId,
      title: dto.title,
      size: dto.size,
      category: dto.category || null,
      description: dto.description,
      contentType: dto.contentType,
      path: dto.path,
      type: dto.type as any,
      tags: dto.tags,
    };

    if (dto.type === ATTACHMENT_TYPES.LINK) {
      const linkAttachment = await this.prisma.projectAttachment.create({
        data: attachmentBody,
      });

      this.logger.debug('New Link Attachment record: ', linkAttachment);

      // emit the Kafka event
      const payload = assign(
        { resource: RESOURCES.ATTACHMENT },
        linkAttachment,
      );
      await this.eventBus.postBusEvent(
        EVENT.ROUTING_KEY.PROJECT_ATTACHMENT_ADDED,
        payload,
      );

      return linkAttachment as any;
    }

    const sourceBucket = dto.s3Bucket;
    const sourceKey = dto.path;
    const destBucket = AppConfig.attachmentsS3Bucket;
    const destKey = path;

    // don't actually transfer file in development mode if file uploading is disabled, so we can test this endpoint
    if (process.env.NODE_ENV !== 'development' || AppConfig.enableFileUpload) {
      await this.utilService.s3FileTransfer(
        sourceBucket,
        sourceKey,
        destBucket,
        destKey,
      );
    }

    // file copied to final destination, create DB record
    this.logger.debug('creating db file record');
    attachmentBody.path = path;
    const fileAttachment = await this.prisma.projectAttachment.create({
      data: attachmentBody,
    });
    let response = cloneDeep(fileAttachment);
    response = omit(response, ['path', 'deletedAt']);

    this.logger.debug('New Attachment record: ', fileAttachment);
    if (process.env.NODE_ENV !== 'development' || AppConfig.enableFileUpload) {
      // retrieve download url for the response
      this.logger.debug('retrieving download url');
      const url = await this.utilService.getDownloadUrl(destBucket, path);
      this.logger.debug('Retrieving Presigned Url resp: ', url);
      response.downloadUrl = url;
    }

    // emit the Kafka event
    const payload = assign({ resource: RESOURCES.ATTACHMENT }, fileAttachment);
    await this.eventBus.postBusEvent(
      EVENT.ROUTING_KEY.PROJECT_ATTACHMENT_ADDED,
      payload,
    );

    return response;
  }

  /**
   * Retrieves all attachments for a specific project.
   * @param req - The request
   * @param projectId - ID of the project to get attachments for
   * @returns Promise resolving to an array of attachment responses
   */
  async searchAttachment(
    req: Request,
    projectId: number,
  ): Promise<AttachmentResponseDto[]> {
    let attachments = await this.prisma.projectAttachment.findMany({
      where: {
        projectId,
        deletedBy: null,
      },
      omit: {
        deletedAt: true,
        deletedBy: true,
      },
    });

    // Permission check need project members
    // we need them inside `context.currentProjectMembers`
    await this.addProjectMemberToContext(req, projectId);

    // check access to attachment
    attachments = filter(attachments, (attachment) =>
      Utils.hasReadAccessToAttachment(attachment, req),
    );

    return attachments as any;
  }

  /**
   * Retrieves a specific attachment by ID.
   * @param req - The request
   * @param projectId - ID of the associated project
   * @param id - ID of the attachment to retrieve
   * @returns Promise resolving to the requested attachment response
   */
  async getAttachment(
    req: Request,
    projectId: number,
    id: number,
  ): Promise<AttachmentResponseDto> {
    let entity = await this.prisma.projectAttachment.findUnique({
      where: {
        id,
        projectId,
      },
    });

    // Permission check need project members
    // we need them inside `context.currentProjectMembers`
    await this.addProjectMemberToContext(req, projectId);

    // check access to attachment
    if (!Utils.hasReadAccessToAttachment(entity, req)) {
      entity = null;
    }

    if (!entity) {
      throw new NotFoundException(
        `attachment not found for project id ${projectId}, id ${id}`,
      );
    }

    const { url } = await this.getPreSignedUrl(entity);

    if (!isEmpty(url)) {
      entity = assign({ url }, entity);
    }

    return entity as any;
  }

  /**
   * This private function gets the pre-signed url if the attachment is a file
   *
   * @param {Object} attachment The project attachment object
   * @returns {Object<Promise>} The object of two promises, first one if the attachment object promise,
   *                           The second promise is for the file pre-signed url (if attachment type is file)
   */
  private async getPreSignedUrl(attachment) {
    // If the attachment is a link return it as-is without getting the pre-signed url
    if (attachment.type === ATTACHMENT_TYPES.LINK) {
      return { attachment, url: '' };
    }

    // The attachment is a file
    // In development mode, if file upload is disabled, we return the dummy attachment object
    if (
      includes(['development'], process.env.NODE_ENV) &&
      !AppConfig.enableFileUpload
    ) {
      return { attachment, url: 'dummy://url' };
    }
    // Not in development mode or file upload is not disabled
    const url = await this.utilService.getDownloadUrl(
      AppConfig.attachmentsS3Bucket,
      attachment.path,
    );
    return { attachment, url };
  }

  /**
   * Updates an existing project attachment.
   * @param req - The request
   * @param projectId - ID of the associated project
   * @param id - ID of the attachment to update
   * @param dto - Data transfer object containing updated attachment details
   * @returns Promise resolving to the updated attachment response
   */
  async updateAttachment(
    req: Request,
    projectId: number,
    id: number,
    dto: UpdateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    const authUser = req['authUser'] as JwtUser;

    const entity = await this.prisma.projectAttachment.findUnique({
      where: {
        id,
        projectId,
        deletedBy: null,
      },
    });

    if (!entity) {
      throw new NotFoundException(
        `attachment not found for project id ${projectId}, id ${id}`,
      );
    }

    if (
      Number(entity.createdBy) !== authUser.userId &&
      !Utils.hasPermissionByReq(
        PERMISSION.UPDATE_PROJECT_ATTACHMENT_NOT_OWN,
        req,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permission to update attachment created by another user.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const allowedUsers = dto.allowedUsers || undefined;
      const updatedEntity = await tx.projectAttachment.update({
        where: {
          id,
        },
        data: {
          ...dto,
          allowedUsers,
          updatedBy: authUser.userId,
        },
      });

      this.logger.debug(
        'updated project attachment',
        JSON.stringify(updatedEntity),
      );

      // emit the Kafka event
      const payload = assign({ resource: RESOURCES.ATTACHMENT }, updatedEntity);
      await this.eventBus.postBusEvent(
        EVENT.ROUTING_KEY.PROJECT_ATTACHMENT_UPDATED,
        payload,
      );

      return updatedEntity;
    }) as any;
  }

  /**
   * Deletes a project attachment.
   * @param req - The request
   * @param projectId - ID of the associated project
   * @param id - ID of the attachment to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteAttachment(
    req: Request,
    projectId: number,
    id: number,
  ): Promise<void> {
    const authUser = req['authUser'] as JwtUser;

    const entity = await this.prisma.projectAttachment.findUnique({
      where: {
        id,
        projectId,
        deletedBy: null,
      },
    });

    if (!entity) {
      throw new NotFoundException(
        `attachment not found for project id ${projectId}, id ${id}`,
      );
    }

    if (
      Number(entity.createdBy) !== authUser.userId &&
      !Utils.hasPermissionByReq(
        PERMISSION.DELETE_PROJECT_ATTACHMENT_NOT_OWN,
        req,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permission to delete attachment created by another user.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.projectAttachment.update({
        where: {
          id,
        },
        data: {
          deletedBy: authUser.userId,
          deletedAt: new Date(),
        },
      });

      if (
        entity.type === ATTACHMENT_TYPES.FILE &&
        (process.env.NODE_ENV !== 'development' || AppConfig.enableFileUpload)
      ) {
        await this.utilService.deleteFile(
          AppConfig.attachmentsS3Bucket,
          entity.path,
        );
      }

      // emit the Kafka event
      const payload = assign({ resource: RESOURCES.ATTACHMENT }, entity);
      await this.eventBus.postBusEvent(
        EVENT.ROUTING_KEY.PROJECT_ATTACHMENT_REMOVED,
        payload,
      );
    });
  }

  /**
   * Add project members to request context
   *
   * @param {express.Request} req - request
   * @param {Number} projectId - project id
   */
  async addProjectMemberToContext(req: any, projectId: number) {
    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId,
      },
    });
    req.context = req.context || {};
    req.context.currentProjectMembers = projectMembers;
  }
}
