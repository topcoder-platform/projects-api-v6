import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectSetting, ValueType } from '@prisma/client';
import {
  CreateProjectSettingDto,
  ProjectSettingValueType,
} from 'src/api/project-setting/dto/create-project-setting.dto';
import { ProjectSettingResponseDto } from 'src/api/project-setting/dto/project-setting-response.dto';
import { UpdateProjectSettingDto } from 'src/api/project-setting/dto/update-project-setting.dto';
import {
  ProjectMember,
  Permission,
} from 'src/shared/interfaces/permission.interface';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';

@Injectable()
export class ProjectSettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async findAll(
    projectId: string,
    user: JwtUser,
    projectMembers: ProjectMember[],
  ): Promise<ProjectSettingResponseDto[]> {
    const parsedProjectId = this.parseBigIntParam(projectId, 'Project id');

    const settings = await this.prisma.projectSetting.findMany({
      where: {
        projectId: parsedProjectId,
        deletedAt: null,
      },
      orderBy: [{ id: 'asc' }],
    });

    return settings
      .filter((setting) =>
        this.permissionService.hasPermission(
          this.toPermission(setting.readPermission),
          user,
          projectMembers,
        ),
      )
      .map((setting) => this.toDto(setting));
  }

  async create(
    projectId: string,
    dto: CreateProjectSettingDto,
    user: JwtUser,
    projectMembers: ProjectMember[],
  ): Promise<ProjectSettingResponseDto> {
    const parsedProjectId = this.parseBigIntParam(projectId, 'Project id');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.prisma.project.findUnique({
      where: {
        id: parsedProjectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${parsedProjectId.toString()} was not found.`,
      );
    }

    const canCreate = this.permissionService.hasPermission(
      this.toPermission(dto.writePermission),
      user,
      projectMembers,
    );

    if (!canCreate) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const existingSetting = await this.prisma.projectSetting.findFirst({
      where: {
        projectId: parsedProjectId,
        key: dto.key,
      },
      select: {
        id: true,
      },
    });

    if (existingSetting) {
      throw new ConflictException(
        `Project setting with key ${dto.key} already exists.`,
      );
    }

    try {
      const created = await this.prisma.projectSetting.create({
        data: {
          projectId: parsedProjectId,
          key: dto.key,
          value: dto.value,
          valueType: this.mapValueType(dto.valueType),
          metadata: this.toJsonInput(dto.metadata || {}),
          readPermission: this.toJsonInput(dto.readPermission),
          writePermission: this.toJsonInput(dto.writePermission),
          createdBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      const response = this.toDto(created);

      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Project setting with key ${dto.key} already exists.`,
          );
        }

        if (error.code === 'P2003') {
          throw new NotFoundException(
            `Project with id ${parsedProjectId.toString()} was not found.`,
          );
        }
      }

      throw error;
    }
  }

  async update(
    projectId: string,
    settingId: string,
    dto: UpdateProjectSettingDto,
    user: JwtUser,
    projectMembers: ProjectMember[],
  ): Promise<ProjectSettingResponseDto> {
    const parsedProjectId = this.parseBigIntParam(projectId, 'Project id');
    const parsedSettingId = this.parseBigIntParam(
      settingId,
      'Project setting id',
    );
    const auditUserId = this.getAuditUserId(user);

    const existingSetting = await this.prisma.projectSetting.findFirst({
      where: {
        id: parsedSettingId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
    });

    if (!existingSetting) {
      throw new NotFoundException(
        `Project setting with id ${settingId} was not found.`,
      );
    }

    const canUpdate = this.permissionService.hasPermission(
      this.toPermission(existingSetting.writePermission),
      user,
      projectMembers,
    );

    if (!canUpdate) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (typeof dto.key === 'string' && dto.key !== existingSetting.key) {
      const duplicateSetting = await this.prisma.projectSetting.findFirst({
        where: {
          projectId: parsedProjectId,
          key: dto.key,
          deletedAt: null,
          id: {
            not: parsedSettingId,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateSetting) {
        throw new ConflictException(
          `Project setting with key ${dto.key} already exists.`,
        );
      }
    }

    const updated = await this.prisma.projectSetting.update({
      where: {
        id: parsedSettingId,
      },
      data: {
        ...(typeof dto.key === 'undefined' ? {} : { key: dto.key }),
        ...(typeof dto.value === 'undefined' ? {} : { value: dto.value }),
        ...(typeof dto.valueType === 'undefined'
          ? {}
          : { valueType: this.mapValueType(dto.valueType) }),
        ...(typeof dto.metadata === 'undefined'
          ? {}
          : { metadata: this.toJsonInput(dto.metadata) }),
        ...(typeof dto.readPermission === 'undefined'
          ? {}
          : { readPermission: this.toJsonInput(dto.readPermission) }),
        ...(typeof dto.writePermission === 'undefined'
          ? {}
          : { writePermission: this.toJsonInput(dto.writePermission) }),
        updatedBy: auditUserId,
      },
    });

    const response = this.toDto(updated);

    return response;
  }

  async delete(
    projectId: string,
    settingId: string,
    user: JwtUser,
    projectMembers: ProjectMember[],
  ): Promise<void> {
    const parsedProjectId = this.parseBigIntParam(projectId, 'Project id');
    const parsedSettingId = this.parseBigIntParam(
      settingId,
      'Project setting id',
    );
    const auditUserId = this.getAuditUserId(user);

    const existingSetting = await this.prisma.projectSetting.findFirst({
      where: {
        id: parsedSettingId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
      select: {
        id: true,
        writePermission: true,
      },
    });

    if (!existingSetting) {
      throw new NotFoundException(
        `Project setting with id ${settingId} was not found.`,
      );
    }

    const canDelete = this.permissionService.hasPermission(
      this.toPermission(existingSetting.writePermission),
      user,
      projectMembers,
    );

    if (!canDelete) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const deleted = await this.prisma.projectSetting.update({
      where: {
        id: parsedSettingId,
      },
      data: {
        deletedAt: new Date(),
        deletedBy: auditUserId,
        updatedBy: auditUserId,
      },
    });

    void deleted;
  }

  private parseBigIntParam(value: string, name: string): bigint {
    const normalized = value.trim();

    if (!/^\d+$/.test(normalized)) {
      throw new BadRequestException(`${name} must be a numeric string.`);
    }

    return BigInt(normalized);
  }

  private getAuditUserId(user: JwtUser): number {
    const normalizedUserId = String(user.userId || '').trim();
    const parsedUserId = Number.parseInt(normalizedUserId, 10);

    if (Number.isNaN(parsedUserId)) {
      throw new ForbiddenException('Authenticated user id must be numeric.');
    }

    return parsedUserId;
  }

  private mapValueType(valueType: ProjectSettingValueType): ValueType {
    return valueType;
  }

  private toPermission(value: unknown): Permission {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return value as Permission;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private toDto(setting: ProjectSetting): ProjectSettingResponseDto {
    return {
      id: setting.id.toString(),
      projectId: setting.projectId.toString(),
      key: setting.key,
      value: setting.value,
      valueType: setting.valueType,
      metadata: (setting.metadata || {}) as Record<string, unknown>,
      readPermission: (setting.readPermission || {}) as Record<string, unknown>,
      writePermission: (setting.writePermission || {}) as Record<
        string,
        unknown
      >,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
      createdBy: setting.createdBy,
      updatedBy: setting.updatedBy,
    };
  }
}
