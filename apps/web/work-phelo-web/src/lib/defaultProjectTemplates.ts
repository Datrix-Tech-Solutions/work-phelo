import { ProjectConfig, ProjectTemplate } from '@/types/hr';

/** Templates every tenant gets. They live in code, not in storage, so they can't be edited or lost. */
export const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'default-scrum',
    name: 'Scrum',
    description: 'Work in fixed sprints with a prioritised backlog and a review at the end.',
    workflow: ['To Do', 'In Progress', 'In Review', 'Done'],
    workTypes: [
      { name: 'Epic', icon: 'EPIC' },
      { name: 'Story', icon: 'STORY' },
      { name: 'Task', icon: 'TASK' },
      { name: 'Bug', icon: 'BUG' },
    ],
    features: ['OBJECTIVES', 'BOARD', 'BACKLOG', 'CALENDAR'],
    priorities: [
      { name: 'Low', color: 'GREEN' },
      { name: 'Medium', color: 'YELLOW' },
      { name: 'High', color: 'ORANGE' },
      { name: 'Urgent', color: 'RED' },
    ],
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'default-kanban',
    name: 'Kanban',
    description: 'Continuous flow: pull work through simple stages and limit work in progress.',
    workflow: ['To Do', 'In Progress', 'Done'],
    workTypes: [
      { name: 'Task', icon: 'TASK' },
      { name: 'Bug', icon: 'BUG' },
      { name: 'Improvement', icon: 'IMPROVEMENT' },
    ],
    features: ['OBJECTIVES', 'BOARD', 'LIST', 'CALENDAR'],
    priorities: [
      { name: 'Low', color: 'GREEN' },
      { name: 'Medium', color: 'YELLOW' },
      { name: 'High', color: 'RED' },
    ],
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

/** Where a new template, or a project started from a blank slate, begins. */
export const BLANK_PROJECT_CONFIG: ProjectConfig = {
  workflow: ['To Do', 'In Progress', 'Done'],
  workTypes: [{ name: 'Task', icon: 'TASK' }],
  features: ['BOARD'],
  priorities: [
    { name: 'Low', color: 'GREEN' },
    { name: 'Medium', color: 'YELLOW' },
    { name: 'High', color: 'RED' },
  ],
};
