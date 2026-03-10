import { BadRequestException } from '@nestjs/common';
import { ProjectMemberRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateMemberDto } from './create-member.dto';

describe('CreateMemberDto', () => {
  it('rejects non-numeric user ids during transformation', () => {
    expect(() =>
      plainToInstance(CreateMemberDto, {
        userId: 'invalid',
        role: ProjectMemberRole.customer,
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts numeric-string user ids', () => {
    const dto = plainToInstance(CreateMemberDto, {
      userId: '456',
      role: ProjectMemberRole.customer,
    });

    expect(dto.userId).toBe(456);
    expect(validateSync(dto)).toEqual([]);
  });
});
