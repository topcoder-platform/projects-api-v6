import { buildProjectWhereClause } from './project.utils';

describe('buildProjectWhereClause', () => {
  it('normalizes quoted keyword phrases into safe search filters', () => {
    const where = buildProjectWhereClause(
      {
        keyword: '"my ba"',
      } as any,
      {
        userId: '123',
        isMachine: false,
      } as any,
      true,
    );

    expect(where).toEqual(
      expect.objectContaining({
        deletedAt: null,
        AND: [
          {
            OR: [
              {
                name: {
                  search: 'my & ba',
                },
              },
              {
                description: {
                  search: 'my & ba',
                },
              },
              {
                name: {
                  contains: 'my ba',
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: 'my ba',
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      }),
    );
  });

  it('does not append invalid full-text filters for empty quoted keywords', () => {
    const where = buildProjectWhereClause(
      {
        keyword: '""',
      } as any,
      {
        userId: '123',
        isMachine: false,
      } as any,
      true,
    );

    expect(where).toEqual({
      deletedAt: null,
    });
  });
});
