import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProjectShowcasePost,
  ProjectShowcasePostStatus,
} from '@prisma/client';
import { Permission } from 'src/shared/constants/permissions';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import {
  ensureProjectNamedPermission,
  getAuditUserId,
  loadProjectPermissionContextBase,
  parseNumericStringId,
} from 'src/shared/utils/service.utils';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CreateProjectShowcasePostDto } from './dto/create-project-showcase-post.dto';
import { ProjectShowcasePostListQueryDto } from './dto/project-showcase-post-list-query.dto';
import { ProjectShowcasePostResponseDto } from './dto/project-showcase-post-response.dto';
import { UpdateProjectShowcasePostDto } from './dto/update-project-showcase-post.dto';
import { signCloudFrontUrl } from 'src/shared/utils/cloudfront.utils';

@Injectable()
export class ProjectShowcasePostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async listPosts(
    criteria: ProjectShowcasePostListQueryDto,
  ): Promise<ProjectShowcasePostResponseDto[]> {
    const page = criteria.page || 1;
    const perPage = criteria.perPage || 20;
    const skip = (page - 1) * perPage;
    const where = this.buildWhere(criteria);
    const orderBy = this.resolveSort(criteria.sort);

    const posts = await this.prisma.projectShowcasePost.findMany({
      where,
      include: {
        industries: {
          include: { industry: true },
        },
        categories: {
          include: { category: true },
        },
        media: true,
      },
      orderBy,
      skip,
      take: perPage,
    });

    return posts.map((post) => this.toDto(post));
  }

  async countPosts(criteria: ProjectShowcasePostListQueryDto): Promise<number> {
    const where = this.buildWhere(criteria);
    return this.prisma.projectShowcasePost.count({ where });
  }

  async listProjectPosts(
    projectId: string,
    criteria: ProjectShowcasePostListQueryDto,
    user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto[]> {
    const parsedProjectId = parseNumericStringId(projectId, 'Project id');
    const project = await loadProjectPermissionContextBase(
      this.prisma,
      parsedProjectId,
    );
    ensureProjectNamedPermission(
      this.permissionService,
      Permission.VIEW_PROJECT,
      user,
      project.members,
    );

    const page = criteria.page || 1;
    const perPage = criteria.perPage || 20;
    const skip = (page - 1) * perPage;
    const where = this.buildWhere(criteria, parsedProjectId);
    const orderBy = this.resolveSort(criteria.sort);

    const posts = await this.prisma.projectShowcasePost.findMany({
      where,
      include: {
        industries: {
          include: { industry: true },
        },
        categories: {
          include: { category: true },
        },
        media: true,
      },
      orderBy,
      skip,
      take: perPage,
    });

    return posts.map((post) => this.toDto(post));
  }

  async countProjectPosts(
    projectId: string,
    criteria: ProjectShowcasePostListQueryDto,
    user: JwtUser,
  ): Promise<number> {
    const parsedProjectId = parseNumericStringId(projectId, 'Project id');
    const project = await loadProjectPermissionContextBase(
      this.prisma,
      parsedProjectId,
    );
    ensureProjectNamedPermission(
      this.permissionService,
      Permission.VIEW_PROJECT,
      user,
      project.members,
    );

    const where = this.buildWhere(criteria, parsedProjectId);
    return this.prisma.projectShowcasePost.count({ where });
  }

  async getPost(
    projectId: string,
    id: string,
    user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto> {
    const parsedProjectId = parseNumericStringId(projectId, 'Project id');
    const parsedId = parseNumericStringId(id, 'Showcase post id');

    const project = await loadProjectPermissionContextBase(
      this.prisma,
      parsedProjectId,
    );
    ensureProjectNamedPermission(
      this.permissionService,
      Permission.VIEW_PROJECT,
      user,
      project.members,
    );

    const post = await this.prisma.projectShowcasePost.findFirst({
      where: {
        id: parsedId,
        projectId: parsedProjectId,
      },
      include: {
        industries: {
          include: { industry: true },
        },
        categories: {
          include: { category: true },
        },
        media: true,
      },
    });

    if (!post) {
      throw new NotFoundException(
        `Showcase post ${id} was not found for project ${projectId}.`,
      );
    }

    return this.toDto(post);
  }

  async createPost(
    projectId: string,
    dto: CreateProjectShowcasePostDto,
    user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto> {
    const parsedProjectId = parseNumericStringId(projectId, 'Project id');
    const project = await loadProjectPermissionContextBase(
      this.prisma,
      parsedProjectId,
    );
    ensureProjectNamedPermission(
      this.permissionService,
      Permission.MANAGE_PROJECT_SHOWCASE_POST,
      user,
      project.members,
    );

    const auditUserId = getAuditUserId(user);
    const industryIds = (dto.industryIds || []).map((industryId) =>
      parseNumericStringId(String(industryId), 'Industry id'),
    );
    const categoryIds = (dto.categoryIds || []).map((categoryId) =>
      parseNumericStringId(String(categoryId), 'Category id'),
    );

    try {
      const created = await this.prisma.projectShowcasePost.create({
        data: {
          title: dto.title,
          content: dto.content,
          status: dto.status ?? 'DRAFT',
          projectId: parsedProjectId,
          challengeIds: dto.challengeIds || [],
          createdById: auditUserId,
          updatedById: auditUserId,
          industries: {
            create: industryIds.map((industryId) => ({ industryId })),
          },
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
          media: {
            create: (dto.media || []).map((asset) => ({
              type: asset.type,
              url: asset.url,
              createdBy: BigInt(auditUserId),
            })),
          },
        },
        include: {
          industries: {
            include: { industry: true },
          },
          categories: {
            include: { category: true },
          },
          media: true,
        },
      });

      return this.toDto(created);
    } catch (error) {
      this.handlePrismaForeignKeyError(error, 'create project showcase post');
    }
  }

  async updatePost(
    projectId: string,
    id: string,
    dto: UpdateProjectShowcasePostDto,
    user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto> {
    const parsedProjectId = parseNumericStringId(projectId, 'Project id');
    const parsedId = parseNumericStringId(id, 'Showcase post id');

    const project = await loadProjectPermissionContextBase(
      this.prisma,
      parsedProjectId,
    );
    ensureProjectNamedPermission(
      this.permissionService,
      Permission.MANAGE_PROJECT_SHOWCASE_POST,
      user,
      project.members,
    );

    const existing = await this.prisma.projectShowcasePost.findFirst({
      where: {
        id: parsedId,
        projectId: parsedProjectId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Showcase post ${id} was not found for project ${projectId}.`,
      );
    }

    const updateData: Prisma.ProjectShowcasePostUpdateInput = {
      ...(typeof dto.title === 'undefined' ? {} : { title: dto.title }),
      ...(typeof dto.content === 'undefined' ? {} : { content: dto.content }),
      ...(typeof dto.status === 'undefined' ? {} : { status: dto.status }),
      ...(typeof dto.challengeIds === 'undefined'
        ? {}
        : { challengeIds: dto.challengeIds }),
      updatedById: getAuditUserId(user),
    };

    if (typeof dto.industryIds !== 'undefined') {
      const industryIds = dto.industryIds.map((industryId) =>
        parseNumericStringId(String(industryId), 'Industry id'),
      );

      updateData.industries = {
        deleteMany: {},
        create: industryIds.map((industryId) => ({ industryId })),
      };
    }

    if (typeof dto.categoryIds !== 'undefined') {
      const categoryIds = dto.categoryIds.map((categoryId) =>
        parseNumericStringId(String(categoryId), 'Category id'),
      );

      updateData.categories = {
        deleteMany: {},
        create: categoryIds.map((categoryId) => ({ categoryId })),
      };
    }

    if (typeof dto.media !== 'undefined' && Array.isArray(dto.media)) {
      const auditUserId = BigInt(getAuditUserId(user));
      updateData.media = {
        deleteMany: {},
        create: dto.media.map((mediaItem) => ({
          type: mediaItem.type,
          url: mediaItem.url,
          createdBy: auditUserId,
        })),
      };
    }

    try {
      const updated = await this.prisma.projectShowcasePost.update({
        where: {
          id: parsedId,
        },
        data: updateData,
        include: {
          industries: {
            include: { industry: true },
          },
          categories: {
            include: { category: true },
          },
          media: true,
        },
      });

      return this.toDto(updated);
    } catch (error) {
      this.handlePrismaForeignKeyError(error, 'update project showcase post');
    }
  }

  async deletePost(
    projectId: string,
    id: string,
    user: JwtUser,
  ): Promise<void> {
    const parsedProjectId = parseNumericStringId(projectId, 'Project id');
    const parsedId = parseNumericStringId(id, 'Showcase post id');

    const project = await loadProjectPermissionContextBase(
      this.prisma,
      parsedProjectId,
    );
    ensureProjectNamedPermission(
      this.permissionService,
      Permission.MANAGE_PROJECT_SHOWCASE_POST,
      user,
      project.members,
    );

    const existing = await this.prisma.projectShowcasePost.findFirst({
      where: {
        id: parsedId,
        projectId: parsedProjectId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Showcase post ${id} was not found for project ${projectId}.`,
      );
    }

    await this.prisma.projectShowcasePost.delete({
      where: {
        id: parsedId,
      },
    });
  }

  private buildWhere(
    criteria: ProjectShowcasePostListQueryDto,
    projectId?: bigint,
  ): Prisma.ProjectShowcasePostWhereInput {
    const where: Prisma.ProjectShowcasePostWhereInput = {};

    if (projectId) {
      where.projectId = projectId;
    } else if (criteria.projectId) {
      const ids = this.toBigIntFilter(criteria.projectId);
      if (ids.length === 1) {
        where.projectId = ids[0];
      } else if (ids.length > 1) {
        where.projectId = { in: ids };
      }
    }

    const status = this.toStringListFilter(criteria.status).map((entry) =>
      String(entry).trim().toUpperCase(),
    ) as ProjectShowcasePostStatus[];
    if (status.length === 1) {
      where.status = status[0];
    } else if (status.length > 1) {
      where.status = { in: status };
    }

    const industryIds = this.toBigIntFilter(criteria.industryId);
    if (industryIds.length > 0) {
      where.industries = {
        some: {
          industryId: { in: industryIds },
        },
      };
    }

    const categoryIds = this.toBigIntFilter(criteria.categoryId);
    if (categoryIds.length > 0) {
      where.categories = {
        some: {
          categoryId: { in: categoryIds },
        },
      };
    }

    if (criteria.challengeId) {
      where.challengeIds = { has: criteria.challengeId };
    }

    if (criteria.keyword) {
      where.OR = [
        { title: { contains: criteria.keyword, mode: 'insensitive' } },
        { content: { contains: criteria.keyword, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private resolveSort(
    sort?: string,
  ): Prisma.Enumerable<Prisma.ProjectShowcasePostOrderByWithRelationInput> {
    if (!sort || sort.trim().length === 0) {
      return [{ updatedAt: 'desc' }];
    }

    const [field, direction = 'desc'] = sort
      .trim()
      .split(/\s+/gi)
      .filter(Boolean);
    const normalizedDirection = direction.toLowerCase().includes('asc')
      ? 'asc'
      : 'desc';

    switch (field) {
      case 'title':
      case 'status':
      case 'createdAt':
      case 'updatedAt':
        return [{ [field]: normalizedDirection }];
      default:
        return [{ updatedAt: 'desc' }];
    }
  }

  private toDto(
    post: ProjectShowcasePost & {
      industries: { industry: { id: bigint; name: string } }[];
      categories: { category: { id: bigint; name: string } }[];
      media: {
        id: bigint;
        type: string;
        url: string;
        createdAt: Date;
        createdBy: bigint;
      }[];
    },
  ): ProjectShowcasePostResponseDto {
    return {
      id: String(post.id),
      title: post.title,
      content: post.content,
      status: post.status,
      projectId: String(post.projectId),
      challengeIds: post.challengeIds,
      createdById: post.createdById,
      updatedById: post.updatedById,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      industries: post.industries.map((entry) => ({
        id: String(entry.industry.id),
        name: entry.industry.name,
      })),
      categories: post.categories.map((entry) => ({
        id: String(entry.category.id),
        name: entry.category.name,
      })),
      media: post.media.map((entry) => ({
        id: String(entry.id),
        type: entry.type,
        url: signCloudFrontUrl(entry.url),
        createdAt: entry.createdAt,
        createdBy: String(entry.createdBy),
      })),
    };
  }

  private handlePrismaForeignKeyError(
    error: unknown,
    operation: string,
  ): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      const meta = error.meta ?? {};
      let constraint = String(meta.constraint ?? '').trim();

      if (!constraint) {
        const match = /constraint:\s*`([^`]*)`/.exec(error.message);
        if (match) {
          constraint = match[1];
        }
      }

      if (
        constraint.includes('project_showcase_post_industries_industry_fkey') ||
        /project_showcase_post_industries.*industry/i.test(constraint)
      ) {
        throw new NotFoundException('Industry not found for provided id.');
      }

      if (
        constraint.includes('project_showcase_post_categories_category_fkey') ||
        /project_showcase_post_categories.*category/i.test(constraint)
      ) {
        throw new NotFoundException('Category not found for provided id.');
      }
    }

    throw error;
  }

  private toBigIntFilter(
    value: string | string[] | Record<string, unknown> | undefined,
  ): bigint[] {
    if (!value) {
      return [];
    }

    const values =
      typeof value === 'string'
        ? [value]
        : Array.isArray(value)
          ? value.map((entry) => String(entry))
          : value &&
              typeof value === 'object' &&
              'in' in value &&
              Array.isArray(value.in)
            ? value.in.map((entry) => String(entry))
            : [];

    return values
      .map((entry) => {
        try {
          return parseNumericStringId(String(entry), 'Filter id');
        } catch {
          return undefined;
        }
      })
      .filter((entry): entry is bigint => typeof entry === 'bigint');
  }

  private toStringListFilter(
    value: string | string[] | Record<string, unknown> | undefined,
  ): string[] {
    if (!value) {
      return [];
    }

    if (typeof value === 'string') {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.map((entry) => String(entry));
    }

    if (
      value &&
      typeof value === 'object' &&
      'in' in value &&
      Array.isArray(value.in)
    ) {
      return value.in.map((entry) => String(entry));
    }

    return [];
  }
}
