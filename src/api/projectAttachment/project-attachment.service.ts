/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { JwtUser } from 'src/auth/auth.dto';
import { PrismaService } from 'src/shared/services/prisma.service';
import {
  AttachmentResponseDto,
  CreateAttachmentDto,
  UpdateAttachmentDto,
} from './project-attachment.dto';

/**
 * Service class for handling project attachment operations.
 * Provides methods for creating, retrieving, updating, and deleting project attachments.
 */
@Injectable()
export class ProjectAttachmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new attachment for a project.
   * @param authUser - Authenticated user creating the attachment
   * @param projectId - ID of the project to attach to
   * @param dto - Data transfer object containing attachment details
   * @returns Promise resolving to the created attachment response
   */
  async createAttachment(
    authUser: JwtUser,
    projectId: string,
    dto: CreateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    return new AttachmentResponseDto();
  }

  /**
   * Retrieves all attachments for a specific project.
   * @param projectId - ID of the project to get attachments for
   * @returns Promise resolving to an array of attachment responses
   */
  async searchAttachment(projectId: string): Promise<AttachmentResponseDto[]> {
    return [new AttachmentResponseDto()];
  }

  /**
   * Retrieves a specific attachment by ID.
   * @param projectId - ID of the associated project
   * @param id - ID of the attachment to retrieve
   * @returns Promise resolving to the requested attachment response
   */
  async getAttachment(
    projectId: string,
    id: string,
  ): Promise<AttachmentResponseDto> {
    return new AttachmentResponseDto();
  }

  /**
   * Updates an existing project attachment.
   * @param authUser - Authenticated user updating the attachment
   * @param projectId - ID of the associated project
   * @param id - ID of the attachment to update
   * @param dto - Data transfer object containing updated attachment details
   * @returns Promise resolving to the updated attachment response
   */
  async updateAttachment(
    authUser: JwtUser,
    projectId: string,
    id: string,
    dto: UpdateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    return new AttachmentResponseDto();
  }

  /**
   * Deletes a project attachment.
   * @param projectId - ID of the associated project
   * @param id - ID of the attachment to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteAttachment(projectId: string, id: string): Promise<void> {}
}
