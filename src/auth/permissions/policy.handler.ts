/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Logger } from '@nestjs/common';
import { Request } from 'express';
import * as _ from 'lodash';
import { PermissionRule } from './constants';
import { PrismaService } from 'src/shared/services/prisma.service';
import Utils from 'src/shared/utils';
import { JwtUser } from '../auth.dto';
import { MANAGER_ROLES } from 'src/shared/constants';

const logger = new Logger('GeneralPermission');

/**
 * General permission check for most endpoints.
 * Copied from tc-project-service/src/permissions/generalPermissions.js
 * @param permissions permission rules
 * @param prisma prisma service
 * @returns async handler for request
 */
export const GeneralPermission =
  (permissions: PermissionRule | PermissionRule[], prisma: PrismaService) =>
  async (req: Request) => {
    const projectId = _.parseInt(req.params.projectId);

    // if one of the `permission` requires to know Project Members, but current route doesn't belong to any project
    // this means such `permission` most likely has been applied by mistake, so we throw an error
    const permissionsRequireProjectMembers = _.isArray(permissions)
      ? _.some(permissions, (permission) =>
          Utils.isPermissionRequireProjectMembers(permission),
        )
      : Utils.isPermissionRequireProjectMembers(permissions as PermissionRule);

    if (
      _.isUndefined(req.params.projectId) &&
      permissionsRequireProjectMembers
    ) {
      throw new Error(
        'Permissions for this route requires Project Members' +
          ', but this route doesn\'t have "projectId".',
      );

      // if we have `projectId`, then retrieve project members no matter if `permission` requires them or no
      // as we often need them inside `context.currentProjectMembers`, so we always load them for consistency
    }
    if (!_.isUndefined(req.params.projectId)) {
      try {
        const projectMembers = await prisma.projectMember.findMany({
          where: { projectId, deletedAt: null },
        });
        (req as any).context = (req as any).context || {};
        (req as any).context.currentProjectMembers = projectMembers;
      } catch (err) {
        // if we could not load members this usually means that project doesn't exists
        // anyway we proceed without members, which could lead to 2 situations:
        // - if user doesn't have permissions to access endpoint without us knowing if he is a member or no,
        //   then for such a user request would fail with 403
        // - if user has permissions to access endpoint even we don't know if he is a member or no,
        //   then code would proceed and endpoint would decide to throw 404 if project doesn't exist
        //   or perform endpoint operation if loading project members above failed because of some other reason
        logger.error(`Cannot load project members: ${err.message}.`);
      }
    }

    const hasPermission = _.isArray(permissions)
      ? _.some(permissions, (permission) =>
          Utils.hasPermissionByReq(permission, req),
        )
      : Utils.hasPermissionByReq(permissions as PermissionRule, req);

    if (!hasPermission) {
      throw new Error('You do not have permissions to perform this action');
    }
  };

/**
 * Check user has permission to view project.
 * Copied from tc-project-service/src/permissions/generalPermissions.js
 * @param req express request
 */
export const ProjectView = (prisma: PrismaService) => async (req: Request) => {
  const projectId = _.parseInt(req.params.projectId);
  const authUser = req['user'] as JwtUser;
  const currentUserId = authUser.userId;

  const members = await prisma.projectMember.findMany({
    where: { projectId, deletedAt: null },
  });
  (req as any).context = (req as any).context || {};
  (req as any).context.currentProjectMembers = members;
  const hasAccess =
    Utils.hasAdminRole(authUser) ||
    Utils.hasRoles(authUser, MANAGER_ROLES) ||
    !_.isUndefined(_.find(members, (m) => m.userId === currentUserId));
  if (!hasAccess) {
    throw new Error("This member can't view this project");
  }
};
