/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import * as _ from 'lodash';
import * as querystring from 'querystring';
import { Request, Response } from 'express';
import { JwtUser } from 'src/auth/auth.dto';
import { SearchResult } from './dto/common.dto';
import { PermissionRule, AccessRule } from 'src/auth/permissions/constants';
import { ADMIN_ROLES, M2M_SCOPES } from './constants';
import { BadRequestException } from '@nestjs/common';

class Utils {
  private constructor() {}

  /**
   * Get user id from jwt user
   * @param authUser auth user
   * @returns user id
   */
  static getUserId(authUser: JwtUser) {
    return authUser.isMachine ? '' : String(authUser.userId);
  }

  /**
   * Helper funtion to verify if user has admin roles
   * @param  {object} authUser  request auth user
   * @return {boolean}      true/false
   */
  static hasAdminRole(authUser: JwtUser): boolean {
    const isMachineToken = authUser.isMachine ?? false;
    const tokenScopes = authUser.scopes;
    if (isMachineToken) {
      if (_.indexOf(tokenScopes, M2M_SCOPES.CONNECT_PROJECT_ADMIN) >= 0)
        return true;
      return false;
    }
    let roles = authUser.roles;
    roles = roles.map((s) => s.toLowerCase());
    return (
      _.intersection(
        roles,
        ADMIN_ROLES.map((r) => r.toLowerCase()),
      ).length > 0
    );
  }

  /**
   * Helper funtion to verify if user has specified roles
   * @param  {Object} authUser  request auth user
   * @param  {Array} roles specified roles
   * @return {boolean}      true/false
   */
  static hasRoles(authUser: JwtUser, roles): boolean {
    const isMachineToken = authUser.isMachine ?? false;
    const tokenScopes = authUser.scopes;
    if (isMachineToken) {
      if (_.indexOf(tokenScopes, M2M_SCOPES.CONNECT_PROJECT_ADMIN) >= 0)
        return true;
      return false;
    }
    let authRoles = authUser.roles;
    authRoles = authRoles.map((s) => s.toLowerCase());
    return (
      _.intersection(
        authRoles,
        roles.map((r) => r.toLowerCase()),
      ).length > 0
    );
  }

  /**
   * Check if permission requires us to provide the list Project Members or no.
   *
   * @param {Object} permission     permission or permissionRule
   *
   * @return {Boolean} true if has permission
   */
  static isPermissionRequireProjectMembers(
    permission: AccessRule | PermissionRule,
  ) {
    if (!permission) {
      return false;
    }

    let allowRule, denyRule;
    if (permission instanceof PermissionRule) {
      allowRule = permission;
      denyRule = null;
    } else {
      allowRule = permission.allowRule;
      denyRule = permission.denyRule;
    }

    const allowRuleRequiresProjectMembers =
      _.get(allowRule, 'projectRoles.length') > 0;
    const denyRuleRequiresProjectMembers =
      _.get(denyRule, 'projectRoles.length') > 0;

    return allowRuleRequiresProjectMembers || denyRuleRequiresProjectMembers;
  }

  static hasPermissionByReq(permission: PermissionRule, req: Request) {
    // as it's very easy to forget "req" argument, throw error to make debugging easier
    if (!req) {
      throw new Error('Method "hasPermissionByReq" requires "req" argument.');
    }

    return Utils.hasPermission(
      permission,
      _.get(req, 'authUser'),
      _.get(req, 'context.currentProjectMembers'),
    );
  }

  /**
   * Check if user has permission.
   *
   * This method uses permission defined in `permission` and checks that the `user` matches it.
   *
   * `permission` may be defined in two ways:
   *  - **Full** way with defined `allowRule` and optional `denyRule`, example:
   *    ```js
   *    {
   *       allowRule: {
   *          projectRoles: [],
   *          topcoderRoles: []
   *       },
   *       denyRule: {
   *          projectRoles: [],
   *          topcoderRoles: []
   *       }
   *    }
   *    ```
   *    If user matches `denyRule` then the access would be dined even if matches `allowRule`.
   *  - **Simplified** way may be used if we only want to define `allowRule`.
   *    We can skip the `allowRule` property and define `allowRule` directly inside `permission` object, example:
   *    ```js
   *    {
   *       projectRoles: [],
   *       topcoderRoles: []
   *    }
   *    ```
   *    This **simplified** permission is equal to a **full** permission:
   *    ```js
   *    {
   *       allowRule: {
   *         projectRoles: [],
   *         topcoderRoles: []
   *       }
   *    }
   *    ```
   *
   * If we define any rule with `projectRoles` list, we also should provide `projectMembers`
   * - the list of project members.
   *
   * @param {Object} permission     permission or permissionRule
   * @param {Object} user           user for whom we check permissions
   * @param {Object} user.roles     list of user roles
   * @param {Object} user.scopes    scopes of user token
   * @param {Array}  projectMembers (optional) list of project members - required to check `topcoderRoles`
   *
   * @returns {Boolean}     true, if has permission
   */
  static hasPermission(
    permission: AccessRule | PermissionRule,
    user,
    projectMembers,
  ) {
    if (!permission) {
      return false;
    }

    let allowRule, denyRule;
    if (permission instanceof PermissionRule) {
      allowRule = permission;
      denyRule = null;
    } else {
      allowRule = permission.allowRule;
      denyRule = permission.denyRule;
    }

    const allow = Utils.matchPermissionRule(allowRule, user, projectMembers);
    const deny = Utils.matchPermissionRule(denyRule, user, projectMembers);

    return allow && !deny;
  }

  /**
   * Check if user match the permission rule.
   *
   * This method uses permission rule defined in `permissionRule`
   * and checks that the `user` matches it.
   *
   * If we define a rule with `projectRoles` list, we also should provide `projectMembers`
   * - the list of project members.
   *
   * `permissionRule.projectRoles` may be equal to `true` which means user is a project member with any role
   *
   * `permissionRule.topcoderRoles` may be equal to `true` which means user is a logged-in user
   *
   * @param {Object}        permissionRule               permission rule
   * @param {Array<String>|Array<Object>|Boolean} permissionRule.projectRoles  the list of project roles of the user
   * @param {Array<String>|Boolean} permissionRule.topcoderRoles the list of Topcoder roles of the user
   * @param {Object}        user                         user for whom we check permissions
   * @param {Object}        user.roles                   list of user roles
   * @param {Object}        user.scopes                  scopes of user token
   * @param {Array}         projectMembers               (optional) list of project members - required to check `topcoderRoles`
   *
   * @returns {Boolean}     true, if has permission
   */
  static matchPermissionRule(permissionRule, user, projectMembers) {
    let hasProjectRole = false;
    let hasTopcoderRole = false;
    let hasScope = false;

    // if no rule defined, no access by default
    if (!permissionRule) {
      return false;
    }

    // check Project Roles
    if (permissionRule.projectRoles && projectMembers) {
      const userId = !_.isNumber(user.userId)
        ? parseInt(String(user.userId), 10)
        : user.userId;
      const member = _.find(projectMembers, { userId });

      // check if user has one of allowed Project roles
      if (permissionRule.projectRoles.length > 0) {
        // as we support `projectRoles` as strings and as objects like:
        // { role: "...", isPrimary: true } we have normalize them to a common shape
        const normalizedProjectRoles = permissionRule.projectRoles.map(
          (rule) => (_.isString(rule) ? { role: rule } : rule),
        );

        hasProjectRole =
          member &&
          _.some(normalizedProjectRoles, (rule) =>
            // checks that common properties are equal
            _.isMatch(member, rule),
          );

        // `projectRoles === true` means that we check if user is a member of the project
        // with any role
      } else if (permissionRule.projectRoles === true) {
        hasProjectRole = !!member;
      }
    }

    // check Topcoder Roles
    if (permissionRule.topcoderRoles) {
      // check if user has one of allowed Topcoder roles
      if (permissionRule.topcoderRoles.length > 0) {
        hasTopcoderRole =
          _.intersection(
            _.get(user, 'roles', []).map((role) => role.toLowerCase()),
            permissionRule.topcoderRoles.map((role) => role.toLowerCase()),
          ).length > 0;

        // `topcoderRoles === true` means that we check if user is has any Topcoder role
        // basically this equals to logged-in user, as all the Topcoder users
        // have at least one role `Topcoder User`
      } else if (permissionRule.topcoderRoles === true) {
        hasTopcoderRole = _.get(user, 'roles', []).length > 0;
      }
    }

    // check M2M scopes
    if (permissionRule.scopes) {
      hasScope =
        _.intersection(_.get(user, 'scopes', []), permissionRule.scopes)
          .length > 0;
    }

    return hasProjectRole || hasTopcoderRole || hasScope;
  }

  /**
   * Get link for a given page.
   * @param {Object} req the HTTP request
   * @param {Number} page the page number
   * @returns {String} link for the page
   */
  static getPageLink(req: Request, page: number) {
    const q = _.assignIn({}, req.query, { page });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return `${req.protocol}://${req.get('Host')}${req.baseUrl}${req.path}?${querystring.stringify(q)}`;
  }

  /**
   * Set HTTP response headers from result.
   * @param {Object} req the HTTP request
   * @param {Object} res the HTTP response
   * @param {Object} result the operation result
   */
  static setResHeaders(req: Request, res: Response, result: SearchResult<any>) {
    const totalPages = Math.ceil(result.total / result.perPage);
    if (result.page > 1) {
      res.set('X-Prev-Page', String(result.page - 1));
    }

    if (result.page < totalPages) {
      res.set('X-Next-Page', String(result.page + 1));
    }
    res.set('X-Page', String(result.page));
    res.set('X-Per-Page', String(result.perPage));
    res.set('X-Total', String(result.total));
    res.set('X-Total-Pages', String(totalPages));
    // set Link header
    if (totalPages > 0) {
      let link = `<${Utils.getPageLink(req, 1)}>; rel="first", <${Utils.getPageLink(req, totalPages)}>; rel="last"`;
      if (result.page > 1) {
        link += `, <${Utils.getPageLink(req, result.page - 1)}>; rel="prev"`;
      }
      if (result.page < totalPages) {
        link += `, <${Utils.getPageLink(req, result.page + 1)}>; rel="next"`;
      }
      res.set('Link', link);
    }

    // Allow browsers access pagination data in headers
    let accessControlExposeHeaders =
      res.get('Access-Control-Expose-Headers') || '';
    accessControlExposeHeaders += accessControlExposeHeaders ? ', ' : '';
    // append new values, to not override values set by someone else
    accessControlExposeHeaders +=
      'X-Page, X-Per-Page, X-Total, X-Total-Pages, X-Prev-Page, X-Next-Page';

    res.set('Access-Control-Expose-Headers', accessControlExposeHeaders);
  }

  /**
   * Parse comma separated string to return array of values.
   * @param {String} fieldStr the string to parse
   * @param {Array} allowedValues the allowed values
   * @returns {Array} the parsed values
   */
  static parseCommaSeparatedString(
    fieldStr: string | undefined,
    allowedValues: string[],
  ) {
    if (!fieldStr || fieldStr.trim().length === 0) {
      return null;
    }
    const values = fieldStr.split(',');
    // used to check duplicate values
    const mapping = {};
    _.forEach(values, (value) => {
      if (value.trim().length === 0) {
        throw new BadRequestException('The input string is empty');
      }
      if (allowedValues && !_.includes(allowedValues, value)) {
        throw new BadRequestException(
          `Field name ${value} is not allowed, allowed field names: ${JSON.stringify(allowedValues)}`,
        );
      }
      if (mapping[value]) {
        throw new BadRequestException(
          `There are duplicate field names: ${value}`,
        );
      }
      mapping[value] = true;
    });
    return values;
  }
}

export default Utils;
