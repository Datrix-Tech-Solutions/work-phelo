import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const image = process.argv[2];
assert.match(
  image ?? '',
  /^workphelo-ai-foundation:[A-Za-z0-9_.-]+$/,
  'Supply the local AI image tag',
);
const owned = [];
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 60000 }).trim();
const inspect = (id) => JSON.parse(docker('inspect', id))[0];
function logs(id) {
  const result = spawnSync('docker', ['logs', id], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, 'Could not inspect disposable container logs');
  return result.stdout + result.stderr;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const env = {
  NODE_ENV: 'production',
  AI_PROVIDER: 'mock',
  AI_ENABLED: 'false',
  AI_MOCK_ENABLED: 'false',
  AI_POLICY_VERSION: 'b6-fixture-v1',
};

function create(settings = env, command = []) {
  const id = docker(
    'create',
    '--name',
    `workphelo-ai-b6-${randomUUID()}`,
    '--label',
    'workphelo.validation=ai-b6',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=16m',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    ...Object.entries(settings).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    image,
    ...command,
  );
  assert.match(id, /^[a-f0-9]{64}$/);
  owned.push(id);
  docker('start', id);
  return id;
}

async function waitFor(id, predicate) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = inspect(id).State;
    if (predicate(state)) return state;
    await pause(250);
  }
  throw new Error('Disposable container did not reach its expected state');
}

try {
  const id = create();
  await waitFor(id, (state) => state.Health?.Status === 'healthy');
  const info = inspect(id);
  assert.equal(info.HostConfig.NetworkMode, 'none');
  assert(!info.HostConfig.PortBindings || Object.keys(info.HostConfig.PortBindings).length === 0);
  docker(
    'exec',
    id,
    'node',
    '-e',
    `
    const assert = require('node:assert/strict'), fs = require('node:fs');
    (async () => {
      assert(process.getuid() > 0);
      for (const name of ['prisma', '@nestjs/cli', 'jest']) {
        assert.throws(() => require.resolve(name));
      }
      assert(!fs.existsSync('/app/apps/ai-service/src'));
      assert(fs.existsSync('/app/apps/ai-service/prisma/generated/client/index.js'));
      const { PrismaClient, Prisma } = require('./prisma/generated/client');
      const client = new PrismaClient({datasources:{db:{url:'postgresql://fixture:fixture@127.0.0.1:1/workphelo_ai_2b1?schema=ai&connect_timeout=1'}},log:[]});
      try {
        // P1001 proves the generated engine loads with runtime OpenSSL/dependencies;
        // network-none and loopback port 1 deliberately prevent any database access.
        await assert.rejects(client.$connect(), error => error instanceof Prisma.PrismaClientInitializationError && error.errorCode === 'P1001');
      } finally { await client.$disconnect(); }
      assert(!fs.existsSync('/app/apps/ai-service/prisma/migrations'));
      assert.deepEqual(fs.readdirSync('/app/apps'), ['ai-service']);
      assert.equal(process.env.DATABASE_URL, undefined);
      const health = await fetch('http://127.0.0.1:4011/api/health');
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), {status:'ok',service:'ai-service'});
      const ready = await fetch('http://127.0.0.1:4011/api/ready');
      assert.equal(ready.status, 200);
      assert.deepEqual(await ready.json(), {status:'ready',service:'ai-service',inferenceAvailable:false});
      for (const path of ['chat','generate','messages','conversations','private-b6-canary?token=private-b6-query']) {
        const response = await fetch('http://127.0.0.1:4011/api/'+path, {headers:{'x-user-role':'SUPER_ADMIN','x-user-id':'private-b6-user','x-tenant-id':'private-b6-tenant','x-request-id':'private-b6-id'}});
        assert.equal(response.status, path === 'conversations' ? 503 : 404);
        const body = await response.json();
        assert.equal(body.code, path === 'conversations' ? 'SERVICE_UNAVAILABLE' : 'NOT_FOUND');
        if (path === 'conversations') assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(body.requestId, response.headers.get('x-request-id'));
      }
      const net = require('node:net');
      await new Promise((resolve,reject) => {
        const socket = net.createConnection({host:'1.1.1.1',port:443});
        socket.once('connect',()=>{socket.destroy();reject(new Error('External egress unexpectedly allowed'));});
        socket.once('error',()=>{socket.destroy();resolve();});
        socket.setTimeout(1000,()=>{socket.destroy();reject(new Error('Expected immediate network isolation'));});
      });
      console.log('Runtime, probes, non-root, production Prisma engine/dependencies, and egress isolation PASS');
    })().catch(error=>{console.error(error.message);process.exitCode=1;});
  `,
  );
  assert(!logs(id).includes('private-b6-'));
  docker('stop', '--time', '5', id);
  assert([0, 143].includes(inspect(id).State.ExitCode), 'SIGTERM required forced termination');
  const interrupt = create();
  await waitFor(interrupt, (state) => state.Health?.Status === 'healthy');
  docker('kill', '--signal', 'SIGINT', interrupt);
  const interrupted = await waitFor(interrupt, (state) => !state.Running);
  assert([0, 130].includes(interrupted.ExitCode));

  for (const [settings, expected] of [
    [{ ...env, AI_ENABLED: 'true' }, 'AI_ENABLED/AI_MOCK_ENABLED'],
    [{ ...env, AI_MOCK_ENABLED: 'true' }, 'AI_ENABLED/AI_MOCK_ENABLED'],
    [{ ...env, AI_PROVIDER: 'private-b6-provider' }, 'AI_PROVIDER'],
    [{ ...env, AI_POLICY_VERSION: '' }, 'AI_POLICY_VERSION'],
  ]) {
    const invalid = create(settings);
    const state = await waitFor(invalid, (state) => !state.Running);
    assert.equal(state.ExitCode, 1);
    const output = logs(invalid);
    assert(output.includes(expected));
    assert(!output.includes('private-b6-provider'));
  }

  // A separate test-only Nest process proves the production guard denies a newly
  // registered route. No inference endpoint is added to the application image.
  const guard = create(env, [
    'node',
    '-e',
    `
    require('reflect-metadata');
    const assert=require('node:assert/strict'), {Controller,Get,Module}=require('@nestjs/common'), {NestFactory}=require('@nestjs/core');
    const {AppModule}=require('./dist/app.module'), {configureApplication}=require('./dist/app.setup');
    class Undeclared { read(){throw new Error('Undeclared handler executed');} }
    Controller('b6-undeclared')(Undeclared);
    Get()(Undeclared.prototype,'read',Object.getOwnPropertyDescriptor(Undeclared.prototype,'read'));
    class Fixture {}
    Module({imports:[AppModule.register({ignoreEnvFile:true})],controllers:[Undeclared]})(Fixture);
    (async()=>{const app=await NestFactory.create(Fixture,{bodyParser:false,logger:false,abortOnError:false});try{
      configureApplication(app,()=>{});await app.listen(0,'127.0.0.1');
      const response=await fetch('http://127.0.0.1:'+app.getHttpServer().address().port+'/api/b6-undeclared',{headers:{'x-user-role':'SUPER_ADMIN','x-gateway-auth-context':'forged'}});
      assert.equal(response.status,403);assert.equal((await response.json()).code,'FORBIDDEN');
    }finally{await app.close();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
  `,
  ]);
  assert.equal((await waitFor(guard, (state) => !state.Running)).ExitCode, 0);
  console.log(
    'Container validation PASS: isolated probes, default deny, safe errors/logs, startup rejection, SIGTERM/SIGINT',
  );
} finally {
  for (const id of owned.reverse()) {
    docker('rm', '--force', id);
  }
}
