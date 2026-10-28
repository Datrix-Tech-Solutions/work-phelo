import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectTemplateDto } from './dto/project-template.dto';
import { ProjectTemplatesService } from './project-templates.service';

const admin: RequestUser = {
  id: 'user-a',
  email: 'user@example.test',
  role: 'TENANT_ADMIN',
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  tenantName: 'Tenant A',
  firstName: 'User',
  moduleConfig: { hr: true },
  featureConfig: {},
  permissions: [],
};

const config = {
  workflow: ['To Do', 'Done'],
  workTypes: [{ name: 'Task', icon: 'TASK' }],
  features: ['BOARD', 'BACKLOG'],
  priorities: [
    { name: 'Low', color: 'GREEN' },
    { name: 'High', color: 'RED' },
  ],
};

const content = {
  objectives: ['Launch'],
  sprints: [{ name: 'Sprint 1', days: 14 }],
  featureLabels: { BACKLOG: 'Sprints' },
};

const dtoOf = (extra: object = {}) =>
  ({ name: 'Campaign', config, content, ...extra }) as ProjectTemplateDto;

type Write = { data: { config: Record<string, unknown> } };

describe('ProjectTemplatesService starter content', () => {
  const template = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };
  const service = new ProjectTemplatesService({
    projectTemplate: template,
  } as unknown as PrismaService);
  const row = (stored: object) => ({
    id: 't1',
    tenantId: 'tenant-a',
    name: 'Campaign',
    description: null,
    defaultKey: null,
    createdAt: new Date(),
    config: stored,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    template.create.mockImplementation(({ data }: Write) =>
      Promise.resolve(row(data.config)),
    );
    template.update.mockImplementation(({ data }: Write) =>
      Promise.resolve(row(data.config)),
    );
  });

  it('stores the content beside the set-up and sends it back', async () => {
    const saved = await service.create('tenant-a', admin, dtoOf());
    expect((template.create.mock.calls[0] as [Write])[0].data.config).toEqual({
      ...config,
      content,
    });
    expect(saved).toMatchObject({ ...config, content });
    expect(saved).not.toHaveProperty('config');
  });

  it('gives a template saved without content an empty one', async () => {
    const saved = await service.create(
      'tenant-a',
      admin,
      dtoOf({ content: undefined }),
    );
    expect(saved.content).toEqual({
      objectives: [],
      sprints: [],
      featureLabels: {},
    });
  });

  it('reads an older template that has no content as empty', async () => {
    template.findMany.mockResolvedValue([row(config)]);
    const [listed] = await service.list('tenant-a');
    expect(listed.content).toEqual({
      objectives: [],
      sprints: [],
      featureLabels: {},
    });
  });

  it('keeps the content it had when an update leaves it out', async () => {
    template.findFirst.mockResolvedValue({ config: { ...config, content } });
    await service.update(
      'tenant-a',
      admin,
      't1',
      dtoOf({ content: undefined }),
    );
    expect(
      (template.update.mock.calls[0] as [Write])[0].data.config.content,
    ).toEqual(content);
  });

  it('only updates a template of its own company', async () => {
    template.findFirst.mockResolvedValue(null);
    await expect(
      service.update('tenant-a', admin, 'other', dtoOf()),
    ).rejects.toThrow(NotFoundException);
    expect(
      (template.findFirst.mock.calls[0] as [{ where: object }])[0].where,
    ).toMatchObject({
      tenantId: 'tenant-a',
    });
  });

  it('rejects repeated objective or sprint names', async () => {
    await expect(
      service.create(
        'tenant-a',
        admin,
        dtoOf({ content: { ...content, objectives: ['A', ' a '] } }),
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(
        'tenant-a',
        admin,
        dtoOf({
          content: {
            ...content,
            sprints: [
              { name: 'S', days: 7 },
              { name: 's', days: 7 },
            ],
          },
        }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(template.create).not.toHaveBeenCalled();
  });
});

describe('ProjectTemplateDto', () => {
  const check = (body: object) =>
    validate(plainToInstance(ProjectTemplateDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('accepts content and cleans the view names', async () => {
    const dto = plainToInstance(ProjectTemplateDto, {
      name: 'Campaign',
      config,
      content: {
        ...content,
        featureLabels: { BACKLOG: '  Sprints  ', NOPE: 'x', BOARD: '   ' },
      },
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.content?.featureLabels).toEqual({ BACKLOG: 'Sprints' });
  });

  it('rejects a sprint with no length', async () => {
    const errors = await check({
      name: 'Campaign',
      config,
      content: { ...content, sprints: [{ name: 'S', days: 0 }] },
    });
    expect(errors).not.toHaveLength(0);
  });

  it('accepts view names on a project config', async () => {
    const errors = await check({
      name: 'Campaign',
      config: { ...config, featureLabels: { BOARD: 'Kanban' } },
    });
    expect(errors).toHaveLength(0);
  });
});
