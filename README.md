# ipfsd-node

[![Travis branch](https://img.shields.io/travis/VandeurenGlenn/ipfsd-node/master.svg?style=for-the-badge)](https://travis-ci.org/vandeurenglenn/ipfsd-node)
[![npm](https://img.shields.io/npm/dt/ipfsd-node.svg?style=for-the-badge)](https://www.npmjs.com/package/ipfsd-node)
[![David](https://img.shields.io/david/vandeurenglenn/ipfsd-node.svg?style=for-the-badge)](https://github.com/vandeurenglenn/ipfsd-node)
[![npm](https://img.shields.io/npm/v/ipfsd-node.svg?style=for-the-badge)](https://www.npmjs.com/package/ipfsd-node)

## install
```sh
npm i --save ipfsd-node
```
## requirements
- nodejs `>= 10.0.0`

## usage
### default (earth)
```js
import node from 'ipfsd-node';

(async () => {
  const defaultNode = await node({ cleanup: true });
  await defaultNode.start();
  await defaultNode.stop();
})();
```
### custom
```js
(async () => {
  import { join } from 'path';
  import node from 'ipfsd-node';

  const options = {
    repoPath: join(process.cwd(), 'testrepo'),
    // repo-configs bootstrap, see https://github.com/crypto-io/repo-configs/tree/master/src/config/templates/bootstrap
    // or array
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
})();
```
