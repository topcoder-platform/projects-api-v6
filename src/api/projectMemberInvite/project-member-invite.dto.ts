import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { INVITE_SOURCE, INVITE_STATUS, PROJECT_MEMBER_ROLE } from "src/shared/constants";



export class CreateInviteDto {

  @ApiPropertyOptional({
    name: 'handles',
    description: 'handles of member',
    isArray: true,
    type: String
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each item must be a string' })
  handles?: string[];

  @ApiPropertyOptional({
    name: 'emails',
    description: 'emails of member',
    isArray: true,
    type: String,
    format: 'email'
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Each item must be a valid email address' })
  emails?: string[];

  @ApiProperty({
    name: 'role',
    enum: Object.values(PROJECT_MEMBER_ROLE)
  })
  @IsString()
  @IsIn(Object.values(PROJECT_MEMBER_ROLE))
  role: string;
}

export class FailedInviteItem {

  @ApiProperty({ name: 'email', description: 'user email' })
  email?: string;

  @ApiProperty({ name: 'handle', description: 'user handle' })
  handle?: string;

  @ApiProperty({ name: 'message', description: 'Invite failed message' })
  message: string;
}

export class InviteResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the project member',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The ID of the associated project',
    example: 123,
  })
  projectId: number;

  @ApiProperty({
    description: 'The ID of the user associated with this project member',
    example: 456,
  })
  userId: number;

  @ApiPropertyOptional({
    description: 'The email address of the project member',
    example: 'member@example.com',
  })
  email?: string;

  @ApiProperty({
    description: 'The role of the member in the project',
    example: 'manager',
    enum: Object.values(PROJECT_MEMBER_ROLE),
  })
  role: string;

  @ApiProperty({
    description: 'The status of the project member invitation/association',
    example: 'pending',
    enum: Object.values(INVITE_STATUS)
  })
  status: string;

  @ApiProperty({
    description: 'Timestamp when the project member was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'ID of the user who created this project member',
    example: 789,
  })
  createdBy: number;

  @ApiProperty({
    description: 'Timestamp when the project member was last updated',
    example: '2023-01-02T00:00:00.000Z',
  })
  updatedAt: string;

  @ApiProperty({
    description: 'ID of the user who last updated this project member',
    example: 789,
  })
  updatedBy: number;
}

@ApiExtraModels(FailedInviteItem)
@ApiExtraModels(InviteResponseDto)
export class CreateInviteResponseDto {
  @ApiProperty({
    description: 'successful member invites',
    isArray: true,
    type: InviteResponseDto
  })
  success: InviteResponseDto[]

  @ApiPropertyOptional({
    description: 'failed member invites',
    isArray: true,
    type: FailedInviteItem
  })
  failed?: FailedInviteItem[]
}

export class UpdateInviteDto {
  @ApiProperty({
    description: 'The status of the project member invitation/association',
    example: 'pending',
    enum: Object.values(INVITE_STATUS)
  })
  @IsString()
  @IsIn(Object.values(INVITE_STATUS))
  status: string;

  @ApiPropertyOptional({
    description: 'source of this update operation',
    default: INVITE_SOURCE.WORK_MANAGER
  })
  @IsOptional()
  @IsString()
  source?: string = INVITE_SOURCE.WORK_MANAGER;
}

