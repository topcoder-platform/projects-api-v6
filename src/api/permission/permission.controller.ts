import { Controller, Get, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtUser } from 'src/auth/auth.dto';
import { PermissionService } from './permission.service';
import { JwtRequired } from 'src/auth/decorators/jwt.decorator';
import { Permission } from 'src/auth/decorators/permissions.decorator';

@Controller('/projects')
export class PermissionController {
  constructor(private readonly service: PermissionService) {}

  /**
   * Get member's project permissions
   * @param req request
   * @param projectId project id
   * @returns member's project permissions
   */
  @Get('/:projectId/permissions')
  @JwtRequired()
  @Permission('permissions.view')
  @ApiOperation({ summary: "Get member's project permission" })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a map between policy and check status',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'boolean',
      },
      example: {
        'projectMember.edit': true,
        'projectMemberInvite.create': true,
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async getPermission(
    @Req() req: Request,
    @Param('projectId') projectId: string,
  ): Promise<Record<string, boolean>> {
    const authUser = req['user'] as JwtUser;
    return this.service.getPermission(authUser, projectId);
  }
}
