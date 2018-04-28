const test = require('tape-async');
const { join } = require('path');
const node = require('./dist/commonjs/node');

test('init & run default node', async tape => {
  tape.plan(1);
  const node = require('./dist/commonjs/node')
  const defaultNode = await node({ cleanup: true });
  await defaultNode.start()
  await defaultNode.stop();
  tape.ok(true);
});

test('init & run custom node', async tape => {
  tape.plan(1);
  const node = require('./dist/commonjs/node')
  const options = {
    repoPath: join(process.cwd(), 'testrepo'),
    bootstrap: 'leofcoin',
    ports: {
      swarm: 4002,
      api: 5002,
      // gateway: 9090
    },
    cleanup: true
  }
  const customNode = await node(options);
  const { addresses } = await customNode.start();
  await customNode.stop();
  tape.ok(true);
  setTimeout(() => {
    process.exit()
  }, 500);
});
