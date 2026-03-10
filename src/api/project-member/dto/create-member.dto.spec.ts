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

  it('accepts numeric-string user ids without coercing them to numbers', () => {
    const dto = plainToInstance(CreateMemberDto, {
      userId: '456',
      role: ProjectMemberRole.customer,
    });

    expect(dto.userId).toBe('456');
    expect(validateSync(dto)).toEqual([]);
  });

  it('preserves numeric-string user ids above Number.MAX_SAFE_INTEGER', () => {
    const dto = plainToInstance(CreateMemberDto, {
      userId: '9007199254740993',
      role: ProjectMemberRole.customer,
    });

    expect(dto.userId).toBe('9007199254740993');
    expect(validateSync(dto)).toEqual([]);
  });

  it('rejects user ids outside the supported bigint range', () => {
    expect(() =>
      plainToInstance(CreateMemberDto, {
        userId: '9223372036854775808',
        role: ProjectMemberRole.customer,
      }),
    ).toThrow(BadRequestException);
  });
});
