import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProjectDto } from './update-project.dto';

describe('UpdateProjectDto', () => {
  it.each([null, ''])(
    'preserves %p billingAccountId as an explicit clear request',
    async (billingAccountId) => {
      const dto = plainToInstance(UpdateProjectDto, {
        billingAccountId,
      });

      expect(dto.billingAccountId).toBeNull();
      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('parses numeric billingAccountId updates', async () => {
    const dto = plainToInstance(UpdateProjectDto, {
      billingAccountId: '80001063',
    });

    expect(dto.billingAccountId).toBe(80001063);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
