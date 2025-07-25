import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { PROJECT_TO_TOPCODER_ROLES_MATRIX } from "src/auth/permissions/constants";
import { FieldsQueryDto } from "../common/common.dto";
import { PROJECT_MEMBER_ROLE } from "src/shared/constants";

const allowedRoles = Object.keys(PROJECT_TO_TOPCODER_ROLES_MATRIX);

const allowedUpdateRoles = [
  PROJECT_MEMBER_ROLE.CUSTOMER,
  PROJECT_MEMBER_ROLE.MANAGER,
  PROJECT_MEMBER_ROLE.ACCOUNT_MANAGER,
  PROJECT_MEMBER_ROLE.COPILOT,
  PROJECT_MEMBER_ROLE.OBSERVER,
  PROJECT_MEMBER_ROLE.PROGRAM_MANAGER,
  PROJECT_MEMBER_ROLE.ACCOUNT_EXECUTIVE,
  PROJECT_MEMBER_ROLE.SOLUTION_ARCHITECT,
  PROJECT_MEMBER_ROLE.PROJECT_MANAGER,
];

export class CreateProjectMemberDto {
  @ApiPropertyOptional({
    name: 'userId',
    description: 'user id to add as project member. Will use current user if not present.'
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  userId?: number;

  @ApiProperty({
    name: 'role',
    enum: allowedUpdateRoles
  })
  @IsString()
  @IsIn(allowedUpdateRoles)
  role: string;
}

export class UpdateProjectMemberDto {
  @ApiPropertyOptional({ name: 'isPrimary', description: 'is primary' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({
    name: 'role',
    enum: allowedRoles
  })
  @IsString()
  @IsIn(allowedRoles)
  role: string;
}

export class ProjectMemberResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the project member',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The ID of the user associated with this project member',
    example: 123,
  })
  userId: number;

  @ApiProperty({
    description: 'Whether this project member is the primary contact',
    example: true,
  })
  isPrimary: boolean;

  @ApiProperty({
    description: 'The ID of the project this member belongs to',
    example: 456,
  })
  projectId: number;

  @ApiProperty({
    description: 'The role of the user in the project',
    example: 'customer',
    enum: allowedRoles,
  })
  role: string;

   @ApiProperty({
    description: 'User handle or username',
    example: 'johndoe',
  })
  handle: string;

  @ApiPropertyOptional({
    description: "User's first name",
    example: 'John',
    required: false,
    nullable: true,
  })
  firstName?: string | null;

  @ApiPropertyOptional({
    description: "User's last name",
    example: 'Doe',
    required: false,
    nullable: true,
  })
  lastName?: string | null;

  @ApiPropertyOptional({
    description: "User's email address",
    example: 'john.doe@example.com',
    required: false,
    nullable: true,
  })
  email?: string | null;

  @ApiPropertyOptional({
    description: "URL to the user's profile photo",
    example: 'https://example.com/photos/john.jpg',
    required: false,
    nullable: true,
  })
  photoURL?: string | null;

  @ApiPropertyOptional({
    description: "User's typical working hour start time",
    example: '09:00',
    required: false,
    nullable: true,
  })
  workingHourStart?: string | null;

  @ApiPropertyOptional({
    description: "User's typical working hour end time",
    example: '17:00',
    required: false,
    nullable: true,
  })
  workingHourEnd?: string | null;

  @ApiPropertyOptional({
    description: "User's time zone",
    example: 'America/New_York',
    required: false,
    nullable: true,
  })
  timeZone?: string | null;

  @ApiProperty({
    description: 'The timestamp when the project member was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'The ID of the user who created this project member',
    example: 789,
  })
  createdBy: number;

  @ApiPropertyOptional({
    description: 'The timestamp when the project member was last updated',
    example: '2023-01-02T00:00:00.000Z',
  })
  updatedAt?: string | null;

  @ApiPropertyOptional({
    description: 'The ID of the user who last updated this project member',
    example: 789,
  })
  updatedBy?: number | null;
}


@ApiExtraModels(FieldsQueryDto)
export class QueryProjectMemberDto extends FieldsQueryDto {

  @ApiPropertyOptional({
    name: 'role', description: 'member role',
    enum: [...allowedRoles, PROJECT_MEMBER_ROLE.ACCOUNT_MANAGER]
  })
  @IsOptional()
  @IsString()
  @IsIn([...allowedRoles, PROJECT_MEMBER_ROLE.ACCOUNT_MANAGER])
  role?: string;
}
