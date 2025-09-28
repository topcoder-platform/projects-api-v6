/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import * as AWS from 'aws-sdk';
import { M2MService } from 'src/shared/services/m2m.service';
import { EventBusService } from 'src/shared/services/event-bus.service';
import { HttpService } from '@nestjs/axios';
import Utils from 'src/shared/utils';
import { EVENT, RESOURCES } from 'src/shared/constants';
import { AppConfig, AwsS3Config } from '../../../config/config';
import {
  concat,
  isEmpty,
  isNil,
  pick,
  get,
  map,
  includes,
  intersection,
  defaults,
  assign,
  isArray,
  union,
  reject,
  find,
  each,
  reduce,
  findIndex,
} from 'lodash';

/**
 * Util service.
 */
@Injectable()
export class UtilService {
  private readonly logger = new Logger(UtilService.name);

  constructor(
    private readonly m2mService: M2MService,
    private readonly httpService: HttpService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Retrieve member details from userIds
   */
  async getMemberDetailsByUserIds(userIds: number[]) {
    try {
      this.logger.debug(
        `Fetch member details with userIds: [${userIds.join(',')}]`,
      );
      const token = await this.m2mService.getM2mToken();
      const res: any = await firstValueFrom(
        this.httpService.get(`${AppConfig.memberServiceEndpoint}`, {
          params: {
            userIds: `[${userIds.join(',')}]`,
            fields: 'userId,handle,firstName,lastName,email,photoURL',
          },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      );
      return res.data;
    } catch (err) {
      this.logger.error('Error occurs while getting member details', err);
      throw new InternalServerErrorException(
        'Error occurs while getting member details',
      );
    }
  }

  /**
   * Retrieve member details from user handles
   */
  async getMemberDetailsByHandles(handles: string[] | undefined) {
    if (
      isNil(handles) ||
      !handles ||
      (isArray(handles) && handles.length <= 0)
    ) {
      return [];
    }

    try {
      const handlesFix = handles.map((h) => `"${h}"`);
      const handleStr = handlesFix.join(',');
      this.logger.debug(`Fetch member details with handles: [${handleStr}]`);
      const token = await this.m2mService.getM2mToken();
      const res: any = await firstValueFrom(
        this.httpService.get(`${AppConfig.memberServiceEndpoint}`, {
          params: {
            handles: `[${handleStr}]`,
            fields:
              'userId,handle,handleLower,firstName,lastName,email,photoURL',
          },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      );
      return res.data;
    } catch (err) {
      this.logger.error('Error occurs while getting member details', err);
      throw new InternalServerErrorException(
        'Error occurs while getting member details',
      );
    }
  }

  /**
   * Retrieve member details from userIds
   */
  async getMemberTraitsByHandle(handle: string) {
    try {
      this.logger.debug(`Fetch member traits with handle: ${handle}`);
      const token = await this.m2mService.getM2mToken();
      const res: any = await firstValueFrom(
        this.httpService.get(
          `${AppConfig.memberServiceEndpoint}/${handle}/traits`,
          {
            params: {
              traitIds: 'connect_info',
            },
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      return res.data;
    } catch (err) {
      this.logger.error('Error occurs while getting member traits', err);
      throw new InternalServerErrorException(
        'Error occurs while getting member traits',
      );
    }
  }

  /**
   * Retrieve member roles from userIds
   */
  async getUserRoles(userId) {
    try {
      const token = await this.m2mService.getM2mToken();
      const res: any = await firstValueFrom(
        this.httpService.get(`${AppConfig.identityServiceEndpoint}/roles`, {
          params: {
            filter: `subjectID=${userId}`,
          },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      this.logger.debug(
        `Roles for user ${userId}: ${JSON.stringify(res.data.result.content)}`,
      );
      return get(res, 'data.result.content', []).map((r) => r.roleName);
    } catch (err) {
      this.logger.error('Error occurs while getting user roles', err);
      throw new InternalServerErrorException(
        'Error occurs while getting user roles',
      );
    }
  }

  /**
   * Retrieve role by role name
   */
  async getRolesByRoleName(roleName) {
    try {
      const token = await this.m2mService.getM2mToken();
      const res: any = await firstValueFrom(
        this.httpService.get(`${AppConfig.identityServiceEndpoint}/roles`, {
          params: {
            filter: `roleName=${roleName}`,
          },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      this.logger.debug(
        `Roles by ${roleName}: ${JSON.stringify(res.data.result.content)}`,
      );
      return get(res, 'data.result.content', [])
        .filter((item) => item.roleName === roleName)
        .map((r) => r.id);
    } catch (err) {
      this.logger.error('Error occurs while getting user roles', err);
      throw new InternalServerErrorException(
        'Error occurs while getting user roles',
      );
    }
  }

  /**
   * Retrieve role detail by role id
   */
  async getRoleInfo(roleId) {
    try {
      const token = await this.m2mService.getM2mToken();
      const res: any = await firstValueFrom(
        this.httpService.get(
          `${AppConfig.identityServiceEndpoint}/roles/${roleId}`,
          {
            params: {
              fields: `subjects`,
            },
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      this.logger.debug(
        `Role info by ${roleId}: ${JSON.stringify(res.data.result.content)}`,
      );
      return get(res, 'data.result.content', {});
    } catch (err) {
      this.logger.error('Error occurs while getting user roles', err);
      throw new InternalServerErrorException(
        'Error occurs while getting user roles',
      );
    }
  }

  /**
   * Filter member details by input fields
   *
   * @param {Array}   members   Array of member objects
   * @param {Array}   fields    Array of fields to be used to filter member objects
   * @param {Object}  req       The request object
   *
   * @return {Array}            Filtered array of member detail objects
   */
  async getObjectsWithMemberDetails(members, fields, req) {
    if (!fields || isEmpty(fields) || isEmpty(members)) {
      return members;
    }

    try {
      const memberTraitFields = [
        'workingHourStart',
        'workingHourEnd',
        'timeZone',
      ];
      let memberDetailFields = ['handle', 'photoURL'];

      // Only Topcoder admins can get emails, first and last name for users
      memberDetailFields = Utils.addUserDetailsFieldsIfAllowed(
        memberDetailFields,
        req,
      );

      let allMemberDetails: any = [];
      if (
        intersection(fields, union(memberDetailFields, memberTraitFields))
          .length > 0
      ) {
        const userIds = reject(map(members, 'userId'), isNil); // some invites may have no `userId`
        allMemberDetails = await this.getMemberDetailsByUserIds(userIds);

        if (intersection(fields, memberTraitFields).length > 0) {
          const promises = map(allMemberDetails, (member) =>
            this.getMemberTraitsByHandle(member.handle).catch((err) => {
              this.logger.error(
                `Cannot get traits for user (userId:${member.userId}, handle: ${member.handle}).`,
              );
              this.logger.debug(
                `Error getting traits for user (userId:${member.userId}, handle: ${member.handle}).`,
                err,
              );
            }),
          );
          const traits = await Promise.all(promises);
          each(traits, (memberTraits) => {
            // if we didn't manage to get traits for the user, skip it
            if (isEmpty(memberTraits)) return;
            const connectInfo = find(
              memberTraits,
              (trait) => trait.traitId === 'connect_info',
            );
            const memberIndex = findIndex(
              allMemberDetails,
              (member) => member.userId === get(memberTraits, '[0].userId'),
            );
            const connectDetails = pick(
              get(connectInfo, 'traits.data.0'),
              'workingHourStart',
              'workingHourEnd',
              'timeZone',
            );

            allMemberDetails.splice(
              memberIndex,
              1,
              assign({}, allMemberDetails[memberIndex], connectDetails),
            );
          });
        }
      }

      // set default null value for all valid fields
      const memberDefaults = reduce(
        fields,
        (acc, field) => {
          const isValidField = includes(
            union(memberDetailFields, memberTraitFields),
            field,
          );
          if (isValidField) {
            acc[field] = null;
          }
          return acc;
        },
        {},
      );

      // pick valid fields from fetched member details
      return map(members, (member) => {
        let memberDetails = find(
          allMemberDetails,
          ({ userId }) => String(userId) === String(member.userId),
        );
        memberDetails = assign(
          {},
          member,
          pick(memberDetails, union(memberDetailFields, memberTraitFields)),
        );

        memberDetails = pick(memberDetails, fields);
        memberDetails = defaults(memberDetails, memberDefaults);

        return memberDetails;
      });
    } catch (err) {
      this.logger.error('Cannot get user details for member.');
      this.logger.debug('Error during getting user details for member.', err);
      // continues without details anyway
      return members;
    }
  }

  /**
   * Lookup user handles from multiple emails
   * @param {Array}   userEmails user emails
   * @param {Number} maximumRequests  limit number of request on one batch
   * @param {Boolean} isPattern  flag to indicate that pattern matching is required or not
   * @return {Promise} promise
   */
  async lookupMultipleUserEmails(
    userEmails,
    maximumRequests,
    isPattern = false,
  ) {
    this.logger.debug(
      `identityServiceEndpoint: ${AppConfig.identityServiceEndpoint}`,
    );

    // request generator function
    const generateRequest = ({ token, email }) => {
      let filter = `email=${email}`;
      if (isPattern) {
        filter += '&like=true';
      }
      return firstValueFrom(
        this.httpService.get(`${AppConfig.identityServiceEndpoint}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          params: {
            fields: 'handle,id,email',
            filter,
          },
          // set longer timeout as default 3000 could be not enough for identity service response
          timeout: 15000,
        }),
      );
    };
    // send batch of requests, one batch at one time
    const sendBatch = (options) => {
      const token = options.token;
      const emails = options.emails;
      const users = options.users || [];
      const batch = options.batch || 0;
      const start = batch * maximumRequests;
      const end = (batch + 1) * maximumRequests;
      const requests = emails
        .slice(start, end)
        .map((userEmail) => generateRequest({ token, email: userEmail }));
      return Promise.all(requests).then((responses) => {
        const data = responses.reduce((contents, response) => {
          const content = get(response, 'data.result.content', []);
          return concat(contents, content);
        }, users);
        this.logger.debug(`UserHandle response batch-${batch}`, data);
        if (end < emails.length) {
          return sendBatch({ token, users: data, emails, batch: batch + 1 });
        }
        return data;
      });
    };

    const m2mToken = await this.m2mService.getM2mToken();
    return sendBatch({ token: m2mToken, emails: userEmails });
  }

  /**
   * Add userId to project
   * @param  {prisma.Transaction} tx
   * @param  {Number} projectId  project id
   * @param  {Object} member  the member to be added to project
   */
  async addUserToProject(tx, projectId, member) {    // eslint-disable-line
    const projectMembers = await tx.projectMember.findMany({
      where: {
        projectId,
        deletedBy: null,
      },
      omit: {
        deletedAt: true,
        deletedBy: true,
      },
      orderBy: { id: 'asc' },
    });

    // check if member is already registered
    const existingMember = find(
      projectMembers,
      (m) => String(m.userId) === String(member.userId),
    );
    if (existingMember) {
      throw new BadRequestException(
        `User already registered for role: ${existingMember.role}`,
      );
    }

    this.logger.debug('creating member', member);

    // register member
    const newMember = tx.projectMember.create({
      data: member,
    });

    // we have to remove all pending invites for the member if any, as we can add a member directly without invite
    const memberInvite = await tx.ProjectMemberInvite.findFirst({
      where: {
        projectId,
        userId: member.userId,
        deletedBy: null,
      },
    });
    if (memberInvite) {
      await tx.ProjectMemberInvite.update({
        where: {
          id: memberInvite.id,
        },
        data: {
          status: 'canceled',
        },
      });
    }

    // emit the event
    const payload = assign({ resource: RESOURCES.PROJECT_MEMBER }, newMember);
    await this.eventBus.postBusEvent(
      EVENT.ROUTING_KEY.PROJECT_MEMBER_ADDED,
      payload,
    );

    return newMember;
  }

  /**
   * Get the download url
   * @param  {String} bucket  bucket
   * @param  {String} key  the file key
   */
  async getDownloadUrl(bucket, key) {
    try {
      const token = await this.m2mService.getM2mToken();
      const res: any = await firstValueFrom(
        this.httpService.post(
          `${AppConfig.fileServiceEndpoint}/downloadurl`,
          {
            bucket,
            key,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      this.logger.debug(
        `Download url for bucket ${bucket}, key ${key}: ${res.data.url}`,
      );
      return get(res, 'data.url');
    } catch (err) {
      this.logger.error('Error occurs while getting download url', err);
      throw new InternalServerErrorException(
        'Error occurs while getting download url',
      );
    }
  }

  /**
   * Get the download url
   * @param  {String} bucket  bucket
   * @param  {String} key  the file key
   */
  async deleteFile(bucket, key) {
    try {
      const token = await this.m2mService.getM2mToken();
      await firstValueFrom(
        this.httpService.post(
          `${AppConfig.fileServiceEndpoint}/deletefile`,
          {
            bucket,
            key,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      this.logger.debug(`Delete file for bucket ${bucket}, key ${key}`);
    } catch (err) {
      this.logger.error('Error occurs while deleting file', err);
      throw new InternalServerErrorException(
        'Error occurs while deleting file',
      );
    }
  }

  /**
   * Moves file from source to destination
   * @param  {string} sourceBucket source bucket
   * @param  {string} sourceKey    source key
   * @param  {string} destBucket   destination bucket
   * @param  {string} destKey      destination key
   * @return {promise}       promise
   */
  async s3FileTransfer(sourceBucket, sourceKey, destBucket, destKey) {
    // Make sure set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in Environment Variables
    const s3 = new AWS.S3(AwsS3Config());

    try {
      const sourceParam = {
        Bucket: sourceBucket,
        Key: sourceKey,
      };

      const copyParam = {
        Bucket: destBucket,
        Key: destKey,
        CopySource: `${sourceBucket}/${sourceKey}`,
      };

      await s3.copyObject(copyParam).promise();
      this.logger.debug(
        `s3FileTransfer: copyObject successfully: ${sourceBucket}/${sourceKey}`,
      );
      // we don't want deleteObject to block the request as it's not critical operation
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      (async () => {
        try {
          await s3.deleteObject(sourceParam).promise();
          this.logger.debug(
            `s3FileTransfer: deleteObject successfully: ${sourceBucket}/${sourceKey}`,
          );
        } catch (e) {
          this.logger.error(
            `s3FileTransfer: deleteObject failed: ${sourceBucket}/${sourceKey} : ${e.message}`,
          );
        }
      })();
      return { success: true };
    } catch (e) {
      this.logger.error(`s3FileTransfer: error: ${e.message}`);
      throw e;
    }
  }
}
