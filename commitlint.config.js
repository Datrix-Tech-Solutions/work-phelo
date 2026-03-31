module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'test', 'chore', 'perf', 'ci', 'revert',
    ]],
    'scope-enum': [2, 'always', [
      'auth', 'hr', 'gateway', 'notification',
      'subscription', 'marketing',
      'types', 'schemas', 'utils', 'config',
      'infra', 'web', 'deps', 'release',
    ]],
    'subject-max-length': [2, 'always', 100],
  },
};
