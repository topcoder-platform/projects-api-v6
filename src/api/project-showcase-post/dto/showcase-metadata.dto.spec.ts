import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectShowcasePostDto } from './create-project-showcase-post.dto';
import { UpdateProjectShowcasePostDto } from './update-project-showcase-post.dto';

describe('showcase request validation', () => {
  it('requires a valid delivery type on create', async () => {
    expect(
      await validate(
        plainToInstance(CreateProjectShowcasePostDto, {
          title: 'Title',
          content: 'Solution',
        }),
      ),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'type' })]),
    );
  });

  it.each([
    { type: 'Invalid' },
    { sendToWin: 'false' },
    { sendToWin: null },
    { customer: null },
    { currentStatus: 'Unknown' },
  ])(
    'rejects invalid supplied values on partial updates: %j',
    async (payload) => {
      expect(
        await validate(plainToInstance(UpdateProjectShowcasePostDto, payload)),
      ).not.toHaveLength(0);
    },
  );

  it('accepts legacy status-only updates without requiring new fields', async () => {
    expect(
      await validate(
        plainToInstance(UpdateProjectShowcasePostDto, { status: 'ARCHIVED' }),
      ),
    ).toHaveLength(0);
  });
});
