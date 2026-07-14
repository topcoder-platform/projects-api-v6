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
import {
  getChallengesPrismaClient,
  getMembersPrismaClient,
  getResourcesPrismaClient,
  getSkillsPrismaClient,
  getSubmitterRoleId,
} from 'src/shared/global/external-prisma.client';
import { ChallengeMetadataDto } from './dto/challenge-metadata.dto';
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
        project: {
          select: { id: true, name: true },
        },
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

    const metadata = await this.loadMetadataForPosts(posts);
    return posts.map((post) =>
      this.toDto(
        post,
        post.challengeIds
          .map((challengeId) => metadata.get(challengeId))
          .filter((entry): entry is ChallengeMetadataDto => Boolean(entry)),
      ),
    );
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
        project: {
          select: { id: true, name: true },
        },
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

    const metadata = await this.loadMetadataForPosts(posts);
    return posts.map((post) =>
      this.toDto(
        post,
        post.challengeIds
          .map((challengeId) => metadata.get(challengeId))
          .filter((entry): entry is ChallengeMetadataDto => Boolean(entry)),
      ),
    );
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
        project: {
          select: {
            id: true,
            name: true,
          },
        },
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

    const metadataMap = await this.loadMetadataForPosts([post]);
    return this.toDto(
      post,
      post.challengeIds
        .map((challengeId) => metadataMap.get(challengeId))
        .filter((entry): entry is ChallengeMetadataDto => Boolean(entry)),
    );
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
    const status = dto.status ?? 'DRAFT';
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
          status,
          projectId: parsedProjectId,
          challengeIds: dto.challengeIds || [],
          createdById: auditUserId,
          updatedById: auditUserId,
          ...(status === 'PUBLISHED'
            ? {
                publishedAt: new Date(),
                publishedBy: auditUserId,
              }
            : {}),
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
              alt: asset.alt,
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

      const metadataMap = await this.loadMetadataForPosts([created]);
      return this.toDto(
        created,
        created.challengeIds
          .map((challengeId) => metadataMap.get(challengeId))
          .filter((entry): entry is ChallengeMetadataDto => Boolean(entry)),
      );
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

    const auditUserId = getAuditUserId(user);
    const updateData: Prisma.ProjectShowcasePostUpdateInput = {
      ...(typeof dto.title === 'undefined' ? {} : { title: dto.title }),
      ...(typeof dto.content === 'undefined' ? {} : { content: dto.content }),
      ...(typeof dto.status === 'undefined' ? {} : { status: dto.status }),
      ...(typeof dto.challengeIds === 'undefined'
        ? {}
        : { challengeIds: dto.challengeIds }),
      updatedById: auditUserId,
    };

    if (dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      updateData.publishedAt = new Date();
      updateData.publishedBy = auditUserId;
    }

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
          alt: mediaItem.alt,
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

      const metadataMap = await this.loadMetadataForPosts([updated]);
      return this.toDto(
        updated,
        updated.challengeIds
          .map((challengeId) => metadataMap.get(challengeId))
          .filter((entry): entry is ChallengeMetadataDto => Boolean(entry)),
      );
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
        {
          project: {
            is: { name: { contains: criteria.keyword, mode: 'insensitive' } },
          },
        },
        {
          project: {
            is: {
              description: { contains: criteria.keyword, mode: 'insensitive' },
            },
          },
        },
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
      case 'publishedAt':
      case 'createdAt':
      case 'updatedAt':
        return [{ [field]: normalizedDirection }];
      default:
        return [{ updatedAt: 'desc' }];
    }
  }

  private toDto(
    post: ProjectShowcasePost & {
      project?: { id: bigint; name: string };
      industries: { industry: { id: bigint; name: string } }[];
      categories: { category: { id: bigint; name: string } }[];
      media: {
        id: bigint;
        type: string;
        url: string;
        alt?: string | null;
        createdAt: Date;
        createdBy: bigint;
      }[];
    },
    challengeMetadata?: ChallengeMetadataDto[],
  ): ProjectShowcasePostResponseDto {
    return {
      id: String(post.id),
      title: post.title,
      content: post.content,
      status: post.status,
      projectId: String(post.projectId),
      projectTitle: post.project?.name,
      challengeIds: post.challengeIds,
      createdById: post.createdById,
      updatedById: post.updatedById,
      publishedAt: post.publishedAt ?? undefined,
      publishedBy: post.publishedBy ?? undefined,
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
        alt: entry.alt ?? undefined,
        createdAt: entry.createdAt,
        createdBy: String(entry.createdBy),
      })),
      challengeMetadata:
        challengeMetadata && challengeMetadata.length > 0
          ? challengeMetadata
          : undefined,
    };
  }

  private async loadMetadataForPosts(
    posts: Array<
      ProjectShowcasePost & {
        industries: { industry: { id: bigint; name: string } }[];
        categories: { category: { id: bigint; name: string } }[];
        media: {
          id: bigint;
          type: string;
          url: string;
          createdAt: Date;
          createdBy: bigint;
        }[];
      }
    >,
  ): Promise<Map<string, ChallengeMetadataDto>> {
    const challengeIds = Array.from(
      new Set(posts.flatMap((post) => post.challengeIds ?? [])),
    );

    if (challengeIds.length === 0) {
      return new Map();
    }

    const challenges = await getChallengesPrismaClient().challenge.findMany({
      where: { id: { in: challengeIds } },
      select: {
        id: true,
        numOfSubmissions: true,
        numOfRegistrants: true,
        track: { select: { name: true } },
        skills: { select: { skillId: true } },
      },
    });

    const submitterRoleId = getSubmitterRoleId();
    const resources = await getResourcesPrismaClient().resource.findMany({
      where: {
        challengeId: { in: challengeIds },
        roleId: submitterRoleId,
      },
      select: {
        challengeId: true,
        memberId: true,
      },
    });

    const memberIds = Array.from(
      new Set(resources.map((resource) => resource.memberId)),
    );

    const members =
      memberIds.length > 0
        ? await getMembersPrismaClient().member.findMany({
            where: {
              userId: { in: memberIds.map((memberId) => BigInt(memberId)) },
            },
            select: {
              userId: true,
              country: true,
              homeCountryCode: true,
              competitionCountryCode: true,
            },
          })
        : [];

    const memberCountry = new Map<string, string>();
    for (const member of members) {
      const country =
        member.competitionCountryCode ||
        member.country ||
        member.homeCountryCode;
      if (country) {
        memberCountry.set(String(member.userId), country);
      }
    }

    const countriesByChallenge = new Map<string, Set<string>>();
    for (const resource of resources) {
      const country = memberCountry.get(resource.memberId);
      if (!country) {
        continue;
      }

      const set =
        countriesByChallenge.get(resource.challengeId) ?? new Set<string>();
      set.add(country);
      countriesByChallenge.set(resource.challengeId, set);
    }

    const uniqueSkillIds = Array.from(
      new Set(
        challenges.flatMap((challenge) =>
          challenge.skills.map((skill) => skill.skillId),
        ),
      ),
    );

    const skillNamesById = new Map<string, string>();
    if (uniqueSkillIds.length > 0) {
      const skills = await getSkillsPrismaClient().skill.findMany({
        where: { id: { in: uniqueSkillIds } },
        select: { id: true, name: true },
      });
      for (const skill of skills) {
        skillNamesById.set(skill.id, skill.name);
      }
    }

    const metadataMap = new Map<string, ChallengeMetadataDto>();

    for (const challenge of challenges) {
      const countries = Array.from(
        countriesByChallenge.get(challenge.id) ?? new Set<string>(),
      ).sort();

      const uniqueIds = Array.from(
        new Set(challenge.skills.map((skillItem) => skillItem.skillId)),
      );
      const skills = uniqueIds.map((skillId) => ({
        id: skillId,
        name: skillNamesById.get(skillId) ?? '',
      }));

      metadataMap.set(challenge.id, {
        challengeId: challenge.id,
        numOfSubmissions: challenge.numOfSubmissions,
        numOfRegistrants: challenge.numOfRegistrants,
        skills,
        track: challenge.track?.name ?? '',
        countries,
      });
    }

    return metadataMap;
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
