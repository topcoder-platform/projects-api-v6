import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentType, ProjectAttachment } from '@prisma/client';
import { basename } from 'path';
import { CreateAttachmentDto } from 'src/api/project-attachment/dto/create-attachment.dto';
import { UpdateAttachmentDto } from 'src/api/project-attachment/dto/update-attachment.dto';
import { Permission } from 'src/shared/constants/permissions';
import { APP_CONFIG } from 'src/shared/config/app.config';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { FileService } from 'src/shared/services/file.service';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { hasAdminRole } from 'src/shared/utils/permission.utils';
import { AttachmentResponseDto } from './dto/attachment-response.dto';

// TODO [DRY]: Move to `src/shared/interfaces/project-permission-context.interface.ts`.
interface ProjectPermissionContext {
  id: bigint;
  members: Array<{
    userId: bigint;
    role: string;
    deletedAt: Date | null;
  }>;
}

@Injectable()
/**
 * Business logic for project attachments. Handles two attachment types: `link`
 * (stored as-is) and `file` (transferred asynchronously from a caller-supplied
 * S3 bucket to `ATTACHMENTS_S3_BUCKET`). Enforces per-attachment read access
 * via `allowedUsers` and resolves creator handles via `MemberService`.
 */
export class ProjectAttachmentService {
  private readonly logger = LoggerService.forRoot('ProjectAttachmentService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly fileService: FileService,
    private readonly memberService: MemberService,
  ) {}

  /**
   * Fetches all non-deleted attachments for a project, filters by
   * `allowedUsers`, and enriches creator handles.
   *
   * @param projectId - Project id from the route.
   * @param user - Authenticated user.
   * @returns Visible attachment DTO list.
   * @throws {BadRequestException} When project id is invalid.
   * @throws {ForbiddenException} When the caller lacks view permission.
   * @throws {NotFoundException} When the project is not found.
   */
  async listAttachments(
    projectId: string,
    user: JwtUser,
  ): Promise<AttachmentResponseDto[]> {
    const parsedProjectId = this.parseId(projectId, 'Project');

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.VIEW_PROJECT_ATTACHMENT,
      user,
      project.members,
    );

    const isAdmin = this.isAdminUser(user, project.members);

    const attachments = await this.prisma.projectAttachment.findMany({
      where: {
        projectId: parsedProjectId,
        deletedAt: null,
      },
      orderBy: {
        id: 'asc',
      },
    });

    const visibleAttachments = attachments.filter((attachment) =>
      this.hasReadAccessToAttachment(attachment, user, isAdmin),
    );
    const creatorHandleMap = await this.getCreatorHandleMap(visibleAttachments);

    return visibleAttachments.map((attachment) =>
      this.toDto(attachment, {
        creatorHandleMap,
        currentUser: user,
      }),
    );
  }

  /**
   * Fetches one non-deleted attachment. For `file` attachments, adds a
   * presigned download URL to the response.
   *
   * @param projectId - Project id from the route.
   * @param attachmentId - Attachment id from the route.
   * @param user - Authenticated user.
   * @returns Attachment DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When caller lacks view permission.
   * @throws {NotFoundException} When project/attachment is missing or hidden.
   */
  async getAttachment(
    projectId: string,
    attachmentId: string,
    user: JwtUser,
  ): Promise<AttachmentResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedAttachmentId = this.parseId(attachmentId, 'Attachment');

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.VIEW_PROJECT_ATTACHMENT,
      user,
      project.members,
    );

    const attachment = await this.prisma.projectAttachment.findFirst({
      where: {
        id: parsedAttachmentId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
    });

    if (!attachment) {
      throw new NotFoundException(
        `Attachment not found for project id ${projectId} and attachment id ${attachmentId}.`,
      );
    }

    const isAdmin = this.isAdminUser(user, project.members);

    if (!this.hasReadAccessToAttachment(attachment, user, isAdmin)) {
      throw new NotFoundException('Record not found');
    }

    const creatorHandleMap = await this.getCreatorHandleMap([attachment]);
    const response = this.toDto(attachment, {
      creatorHandleMap,
      currentUser: user,
    });

    if (attachment.type === AttachmentType.file) {
      response.url = await this.resolveDownloadUrl(attachment.path);
    }

    return response;
  }

  /**
   * Creates link or file attachments. Link attachments are inserted directly.
   * File attachments validate source metadata, create a destination path,
   * persist the row, and trigger asynchronous S3 transfer.
   *
   * @param projectId - Project id from the route.
   * @param dto - Attachment create payload.
   * @param user - Authenticated user.
   * @returns Created attachment DTO.
   * @throws {BadRequestException} When route ids, file metadata, or path are invalid.
   * @throws {ForbiddenException} When caller lacks create permission.
   * @throws {NotFoundException} When project is missing.
   */
  async createAttachment(
    projectId: string,
    dto: CreateAttachmentDto,
    user: JwtUser,
  ): Promise<AttachmentResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.CREATE_PROJECT_ATTACHMENT,
      user,
      project.members,
    );
    const createdAt = new Date();

    if (dto.type === AttachmentType.link) {
      const createdLink = await this.prisma.projectAttachment.create({
        data: {
          projectId: parsedProjectId,
          title: dto.title,
          description: dto.description || null,
          category: dto.category || null,
          size: typeof dto.size === 'number' ? Math.trunc(dto.size) : null,
          path: dto.path,
          type: dto.type,
          tags: dto.tags || [],
          contentType: dto.contentType || null,
          allowedUsers: dto.allowedUsers || [],
          createdAt,
          createdBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      const creatorHandleMap = await this.getCreatorHandleMap([createdLink]);
      const response = this.toDto(createdLink, {
        creatorHandleMap,
        currentUser: user,
      });
      return response;
    }

    if (!dto.s3Bucket || !dto.contentType) {
      throw new BadRequestException(
        's3Bucket and contentType are required for file attachments.',
      );
    }
    // TODO [SECURITY]: Validate that `s3Bucket` is an allowed/trusted bucket (e.g., a whitelist in `APP_CONFIG`) to prevent reading from arbitrary S3 buckets.

    const fileName = basename(dto.path);
    if (!fileName) {
      throw new BadRequestException('Invalid file path.');
    }

    // Keep legacy path convention expected by work-manager consumers.
    const destinationPath = this.buildDestinationPath(
      parsedProjectId,
      fileName,
    );

    const createdFileAttachment = await this.prisma.projectAttachment.create({
      data: {
        projectId: parsedProjectId,
        title: dto.title,
        description: dto.description || null,
        category: dto.category || null,
        size: typeof dto.size === 'number' ? Math.trunc(dto.size) : null,
        path: destinationPath,
        type: dto.type,
        tags: dto.tags || [],
        contentType: dto.contentType,
        allowedUsers: dto.allowedUsers || [],
        createdAt,
        createdBy: auditUserId,
        updatedBy: auditUserId,
      },
    });

    const downloadUrl = await this.resolveDownloadUrl(destinationPath);
    const creatorHandleMap = await this.getCreatorHandleMap([
      createdFileAttachment,
    ]);
    const response = this.toDto(createdFileAttachment, {
      creatorHandleMap,
      currentUser: user,
      downloadUrl,
    });

    const shouldTransfer =
      process.env.NODE_ENV !== 'development' || APP_CONFIG.enableFileUpload;

    if (shouldTransfer) {
      // TODO [SECURITY/RELIABILITY]: Consider a two-phase approach: transfer first, then insert the DB record. Alternatively, add a `transferStatus` column and a background reconciliation job.
      void this.fileService
        .transferFile(
          dto.s3Bucket,
          dto.path,
          APP_CONFIG.attachmentsS3Bucket,
          destinationPath,
        )
        .catch((error) => {
          this.logger.error(
            `Async file transfer failed for attachment path=${destinationPath}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        });
    }

    return response;
  }

  /**
   * Updates an attachment with creator-only enforcement unless the caller has
   * `UPDATE_PROJECT_ATTACHMENT_NOT_OWN`.
   *
   * @param projectId - Project id from the route.
   * @param attachmentId - Attachment id from the route.
   * @param dto - Attachment update payload.
   * @param user - Authenticated user.
   * @returns Updated attachment DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When caller lacks edit permissions.
   * @throws {NotFoundException} When project/attachment is missing.
   */
  async updateAttachment(
    projectId: string,
    attachmentId: string,
    dto: UpdateAttachmentDto,
    user: JwtUser,
  ): Promise<AttachmentResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedAttachmentId = this.parseId(attachmentId, 'Attachment');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.EDIT_PROJECT_ATTACHMENT,
      user,
      project.members,
    );

    const existingAttachment = await this.prisma.projectAttachment.findFirst({
      where: {
        id: parsedAttachmentId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
    });

    if (!existingAttachment) {
      throw new NotFoundException(
        `Attachment not found for project id ${projectId} and attachment id ${attachmentId}.`,
      );
    }

    const isCreator = existingAttachment.createdBy === auditUserId;

    if (
      !isCreator &&
      !this.permissionService.hasNamedPermission(
        Permission.UPDATE_PROJECT_ATTACHMENT_NOT_OWN,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permission to update an attachment created by another user.",
      );
    }

    const updatedAttachment = await this.prisma.projectAttachment.update({
      where: {
        id: parsedAttachmentId,
      },
      data: {
        title: typeof dto.title === 'string' ? dto.title : undefined,
        description:
          typeof dto.description === 'string' ? dto.description : undefined,
        allowedUsers: Array.isArray(dto.allowedUsers)
          ? dto.allowedUsers
          : undefined,
        tags: Array.isArray(dto.tags) ? dto.tags : undefined,
        path: dto.path,
        updatedBy: auditUserId,
      },
    });

    const creatorHandleMap = await this.getCreatorHandleMap([
      updatedAttachment,
    ]);
    const response = this.toDto(updatedAttachment, {
      creatorHandleMap,
      currentUser: user,
    });

    return response;
  }

  /**
   * Soft deletes an attachment and, for file attachments, triggers asynchronous
   * S3 deletion.
   *
   * @param projectId - Project id from the route.
   * @param attachmentId - Attachment id from the route.
   * @param user - Authenticated user.
   * @returns Nothing.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When caller lacks delete permission.
   * @throws {NotFoundException} When project/attachment is missing.
   */
  async deleteAttachment(
    projectId: string,
    attachmentId: string,
    user: JwtUser,
  ): Promise<void> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedAttachmentId = this.parseId(attachmentId, 'Attachment');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.DELETE_PROJECT_ATTACHMENT,
      user,
      project.members,
    );

    const attachment = await this.prisma.projectAttachment.findFirst({
      where: {
        id: parsedAttachmentId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
    });

    if (!attachment) {
      throw new NotFoundException(
        `Attachment not found for project id ${projectId} and attachment id ${attachmentId}.`,
      );
    }

    await this.prisma.projectAttachment.update({
      where: {
        id: parsedAttachmentId,
      },
      data: {
        deletedAt: new Date(),
        deletedBy: BigInt(auditUserId),
        updatedBy: auditUserId,
      },
    });

    const shouldDeleteFile =
      attachment.type === AttachmentType.file &&
      (process.env.NODE_ENV !== 'development' || APP_CONFIG.enableFileUpload);

    if (shouldDeleteFile) {
      // TODO [SECURITY/RELIABILITY]: S3 object may not be deleted if the async call fails. Consider a deletion queue or synchronous delete.
      void this.fileService
        .deleteFile(APP_CONFIG.attachmentsS3Bucket, attachment.path)
        .catch((error) => {
          this.logger.error(
            `Async file delete failed for attachment path=${attachment.path}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        });
    }
  }

  /**
   * Loads project members required for permission checks.
   *
   * @param projectId - Parsed project id.
   * @returns Permission context.
   * @throws {NotFoundException} When project does not exist.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private async getProjectPermissionContext(
    projectId: bigint,
  ): Promise<ProjectPermissionContext> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        members: {
          where: {
            deletedAt: null,
          },
          select: {
            userId: true,
            role: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    return project;
  }

  /**
   * Builds destination path for canonical attachment storage.
   *
   * @param projectId - Parsed project id.
   * @param fileName - File basename.
   * @returns Destination object key path.
   */
  // TODO [BUG]: The prefix appears twice in the path. Verify the intended path structure and fix to `${prefix}/${projectId}/${fileName}`.
  private buildDestinationPath(projectId: bigint, fileName: string): string {
    const prefix = APP_CONFIG.projectAttachmentPathPrefix;
    return `${prefix}/${projectId.toString()}/${prefix}/${fileName}`;
  }

  /**
   * Evaluates attachment read visibility for the current user.
   *
   * @param attachment - Attachment row.
   * @param user - Authenticated user.
   * @param isAdmin - Whether caller has admin visibility.
   * @returns `true` when attachment is readable.
   */
  private hasReadAccessToAttachment(
    attachment: ProjectAttachment,
    user: JwtUser,
    isAdmin: boolean,
  ): boolean {
    if (isAdmin) {
      return true;
    }

    const allowedUsers = attachment.allowedUsers || [];

    // Empty allowedUsers means attachment is readable by project members.
    if (allowedUsers.length === 0) {
      return true;
    }

    const userId = Number.parseInt(String(user.userId || ''), 10);

    if (Number.isNaN(userId)) {
      return false;
    }

    return allowedUsers.includes(userId);
  }

  /**
   * Enforces a named permission using project members context.
   *
   * @param permission - Permission to verify.
   * @param user - Authenticated user.
   * @param projectMembers - Active project members.
   * @returns Nothing.
   * @throws {ForbiddenException} When permission is missing.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private ensureNamedPermission(
    permission: Permission,
    user: JwtUser,
    projectMembers: Array<{
      userId: bigint;
      role: string;
      deletedAt: Date | null;
    }>,
  ): void {
    const hasPermission = this.permissionService.hasNamedPermission(
      permission,
      user,
      projectMembers,
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Determines whether caller should bypass attachment-level user filtering.
   *
   * @param user - Authenticated user.
   * @param projectMembers - Active project members.
   * @returns `true` when caller has admin-level access.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private isAdminUser(
    user: JwtUser,
    projectMembers: Array<{
      userId: bigint;
      role: string;
      deletedAt: Date | null;
    }>,
  ): boolean {
    return (
      hasAdminRole(user) ||
      this.permissionService.hasNamedPermission(
        Permission.READ_PROJECT_ANY,
        user,
        projectMembers,
      )
    );
  }

  /**
   * Resolves attachment download URL. In development file-upload bypass mode,
   * returns raw path.
   *
   * @param path - Attachment storage path.
   * @returns Download URL or raw path.
   */
  // TODO [SECURITY]: Ensure `NODE_ENV` is not accidentally set to `development` in production deployments, as this bypasses presigned URL generation.
  private async resolveDownloadUrl(path: string): Promise<string> {
    const shouldUseRealUploadFlow =
      process.env.NODE_ENV !== 'development' || APP_CONFIG.enableFileUpload;

    if (!shouldUseRealUploadFlow) {
      return path;
    }

    return this.fileService.getPresignedDownloadUrl(
      APP_CONFIG.attachmentsS3Bucket,
      path,
    );
  }

  /**
   * Maps attachment row plus optional computed values into response DTO.
   *
   * @param attachment - Attachment row.
   * @param extra - Optional URL/handle enrichment values.
   * @returns Attachment response DTO.
   */
  private toDto(
    attachment: ProjectAttachment,
    extra: {
      url?: string;
      downloadUrl?: string;
      creatorHandleMap?: Map<number, string>;
      currentUser?: JwtUser;
    } = {},
  ): AttachmentResponseDto {
    const creatorHandleMap =
      extra.creatorHandleMap || new Map<number, string>();
    const response: AttachmentResponseDto = {
      id: attachment.id.toString(),
      projectId: attachment.projectId.toString(),
      title: attachment.title,
      type: attachment.type,
      path: attachment.path,
      size: attachment.size,
      category: attachment.category,
      description: attachment.description,
      contentType: attachment.contentType,
      tags: attachment.tags,
      allowedUsers: attachment.allowedUsers,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
      createdBy: this.resolveCreatedByHandle(
        attachment,
        creatorHandleMap,
        extra.currentUser,
      ),
      updatedBy: attachment.updatedBy,
    };

    if (typeof extra.url !== 'undefined') {
      response.url = extra.url;
    }

    if (typeof extra.downloadUrl !== 'undefined') {
      response.downloadUrl = extra.downloadUrl;
    }

    return response;
  }

  /**
   * Resolves creator handle map for attachment rows.
   *
   * @param attachments - Attachment rows.
   * @returns Map of numeric user id to handle.
   */
  private async getCreatorHandleMap(
    attachments: ProjectAttachment[],
  ): Promise<Map<number, string>> {
    const creatorIds = Array.from(
      new Set(attachments.map((attachment) => attachment.createdBy)),
    );

    if (creatorIds.length === 0) {
      return new Map<number, string>();
    }

    const details =
      await this.memberService.getMemberDetailsByUserIds(creatorIds);
    const map = new Map<number, string>();

    for (const detail of details) {
      const userId = Number.parseInt(String(detail.userId || ''), 10);
      const handle = String(detail.handle || '').trim();

      if (Number.isNaN(userId) || !handle) {
        continue;
      }

      map.set(userId, handle);
    }

    return map;
  }

  /**
   * Resolves createdBy handle from enriched map with current-user fallback.
   *
   * @param attachment - Attachment row.
   * @param creatorHandleMap - Map of creator ids to handles.
   * @param user - Optional authenticated user for fallback.
   * @returns Resolved handle string or empty string.
   */
  private resolveCreatedByHandle(
    attachment: ProjectAttachment,
    creatorHandleMap: Map<number, string>,
    user?: JwtUser,
  ): string {
    const handle = creatorHandleMap.get(attachment.createdBy);
    if (handle) {
      return handle;
    }

    const currentUserId = Number.parseInt(String(user?.userId || ''), 10);
    const currentUserHandle = String(user?.handle || '').trim();

    if (
      !Number.isNaN(currentUserId) &&
      currentUserId === attachment.createdBy &&
      currentUserHandle.length > 0
    ) {
      return currentUserHandle;
    }

    return '';
  }

  /**
   * Parses route ids into bigint values.
   *
   * @param value - Raw route id.
   * @param entityName - Entity label for exception messages.
   * @returns Parsed bigint id.
   * @throws {BadRequestException} When parsing fails.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private parseId(value: string, entityName: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${entityName} id is invalid.`);
    }
  }

  /**
   * Parses authenticated user id for audit columns.
   *
   * @param user - Authenticated user.
   * @returns Numeric user id.
   */
  // TODO [SECURITY]: Returning `-1` silently when `user.userId` is invalid can corrupt audit trails; throw `UnauthorizedException` instead.
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private getAuditUserId(user: JwtUser): number {
    const userId = Number.parseInt(String(user.userId || ''), 10);

    if (Number.isNaN(userId)) {
      return -1;
    }

    return userId;
  }
}
