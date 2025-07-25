import { Injectable } from "@nestjs/common";
import { JwtUser } from "src/auth/auth.dto";
import { PrismaService } from "src/shared/services/prisma.service";


@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user permission on project
   * @param authUser auth user
   * @param projectId project id
   * @returns map between policy and check status
   */
  async getPermission(
    authUser: JwtUser,
    projectId: string,
  ): Promise<Record<string, boolean>> {
    return {};
  }
}
