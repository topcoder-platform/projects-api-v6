import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { CreateProjectsPrismaClientOptions } from '../../../packages/projects-prisma-client';

describe('@topcoder/projects-api-v6', () => {
  const packagePath = resolve(
    __dirname,
    '../../../packages/projects-prisma-client',
  );

  it('exports generated enums and creates a PrismaPg-backed client', () => {
    const options: CreateProjectsPrismaClientOptions = {
      schema: 'projects',
    };
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `const pkg = require(${JSON.stringify(packagePath)});
         const client = pkg.createProjectsPrismaClient('postgresql://test:test@localhost:5432/projects?schema=${options.schema}');
         process.stdout.write(JSON.stringify({
           status: pkg.CopilotOpportunityStatus.active,
           hasDelegate: Boolean(client.copilotOpportunity)
         }));
         client.$disconnect();`,
      ],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      status: 'active',
      hasDelegate: true,
    });
  });

  it('rejects an empty connection string without opening a connection', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          '-e',
          `const pkg = require(${JSON.stringify(packagePath)}); pkg.createProjectsPrismaClient('');`,
        ],
        { stdio: 'pipe' },
      ),
    ).toThrow('connectionString must be a non-empty string.');
  });

  it('exposes a typed factory option contract', () => {
    const options: CreateProjectsPrismaClientOptions = {
      schema: 'custom_schema',
      clientOptions: {
        log: ['warn', 'error'],
      },
    };

    expect(options).toEqual(
      expect.objectContaining({
        schema: 'custom_schema',
      }),
    );
  });
});
