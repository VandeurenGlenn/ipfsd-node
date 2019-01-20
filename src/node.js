// ipfs modules
import * as Repo from 'ipfs-repo';
import * as IPFSFactory from 'ipfsd-ctl';
// buildin modules
import { join } from 'path';
import { unlinkSync, rmdirSync } from 'fs';

import chalk from 'chalk';
import { config } from 'repo-configs';
import * as fs from 'crypto-io-fs';
import del from 'del';
import normalizeNewline from 'normalize-newline';
import { merge } from 'lodash';

const { exists, write, read } = fs;
const factory = IPFSFactory.create({type: 'go'});

if (process.platform === 'win32') {
  const readLine = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readLine.on('SIGINT', () => {
    process.emit('SIGINT');
  });
};

const spawn = options => new Promise((resolve, reject) => {
  factory.spawn(options, (error, ipfsd) => {
    if (error) reject(error);
    resolve(ipfsd);
  });
});

const start = (ipfsd, flags) => new Promise(async (resolve, reject) => {
  ipfsd.start(flags, error => {
    if (error) reject(error);
    if (ipfsd.api) {
      ipfsd.api.id().then(({id, addresses}) => {
        console.group(chalk.green('ipfs daemon started and listening on'));
        addresses.forEach(address => console.log(chalk.cyan(address)))
        console.groupEnd();
        resolve({id, addresses})
      }).catch(error => reject(error))
    } else {
      return start(ipfsd, flags)
    }

  });
});

const cleanRepo = async repoPath => {
  console.log(`cleaning repo`);
  try {
    const arr = [
      join(repoPath, 'api'),
      join(repoPath, 'repo.lock')
    ]
    let count = 0;
    for (const path of arr) {
      count++;
      const fileExists = await exists(path)
      if (fileExists) unlinkSync(path)
      if (count === arr.length) {
        return;
      }
    }
  } catch (error) {
    throw Error(error)
  }
};
/**
  * @typedef {Object} defaultOptions
  * @property {boolean} options.sharding - desc
  * @property {boolean} [option.force=false] - overwrite existing config
  * @property {boolean} [option.cleanup=false] - clean repo
  * @property {string} [options.repoPath='cwd/repo'] - path to ipfs repo
  * @property {string|array} [options.bootstrap='earth'] - selects bootstrap & swarmkey for wanted network, you can also pass an array with addresses yourself
  * @property {string} [options.network='earth'] - selects bootstrap & swarmkey for wanted network
  * @property {boolean} [options.sharding=true] - check [directory-sharding--hamt](https://github.com/ipfs/go-ipfs/blob/master/docs/experimental-features.md#directory-sharding--hamt) to learn more
  * @property {boolean} [options.filestore=true] - check [ipfs-filestore](https://github.com/ipfs/go-ipfs/blob/master/docs/experimental-features.md#ipfs-filestore) to learn more
  * @property {boolean} [options.streamMounting=false] - check [Libp2pStreamMounting](https://github.com/ipfs/go-ipfs/blob/master/docs/experimental-features.md#ipfs-p2p) to learn more
  * @property {boolean} [option.relayHop=true] - check [circuit-relay](https://github.com/ipfs/go-ipfs/blob/master/docs/experimental-features.md#circuit-relay) to learn more
  * @property {boolean} [options.autoRelay=true] - check [autorelay](https://github.com/ipfs/go-ipfs/blob/master/docs/experimental-features.md#autorelay) to learn more
  * @property {boolean} [options.autoNAT=true] - check [autorelay](https://github.com/ipfs/go-ipfs/blob/master/docs/experimental-features.md#autorelay) to learn more
  */
const defaultOptions = {
  repoPath: join(process.cwd(), 'repo'),
  force: false, // overwrite existing config
  cleanup: false,
  sharding: true,
  filestore: true,
  relayHop: true,
  autoNAT: true,
  autoRelay: true,
  streamMounting: false
}
class Node {
  /**
   * @param {object} [options=defaultOptions] - see {@link defaultOptions}
   */
  constructor(options) {
     return (async () => {
       this.options = merge(defaultOptions, this.options || {})
       this.repo = new Repo(this.options.repoPath);
       const fileExists = await exists(join(this.options.repoPath, 'config'));
       if (fileExists && !this.options.force) {
         this.config = await read(join(this.options.repoPath, 'config'), 'string');
         this.config = JSON.parse(this.config);
         this.config.Swarm.EnableAutoNATService = this.options.autoNAT;
         this.config.Swarm.EnableAutoRelay = this.options.autoRelay;
         this.config.Swarm.EnableRelayHop = this.options.relayHop;
         this.config.Experimental.ShardingEnabled = this.options.sharding;
         this.config.Experimental.FilestoreEnabled = this.options.filestore;
         this.config.Experimental.Libp2pStreamMounting = this.options.streamMounting;
         write(join(this.options.repoPath, 'config'), JSON.stringify(this.config))
       };
       if (!fileExists || this.options.force) await this.init();
       else await this.prepareRepo();
       this.ipfsd = await spawn({start: false, init: false, repoPath: this.options.repoPath, disposable: false});
       return this
       // {
       //   start: async () => this.startIpfsd(ipfsd, this.options),
       //   stop: async () => {
       //     await ipfsd.stop()
       //     if (this.options.cleanup) await del(this.options.repoPath)
       //   },
       //   init: () => initRepo(this.repo, this.options)
       // }
     })()
   }

  async start() {
    const ipfstStartTime = Date.now();
    try {

     const { id, addresses } = await start(this.ipfsd, this.options.flags);

     console.log(`Daemon startup time: ${(Date.now() - ipfstStartTime) / 1000}s`);
     return { ipfs: this.ipfsd.api, id, addresses };

    } catch (error) {
     if (error.message.includes('cannot acquire lock') ||
         error.code === 'ECONNREFUSED') {
       await cleanRepo(this.options.repoPath);
     }
     return this.start(this.ipfsd, this.options);
    }
  }
  async stop() {
    await this.ipfsd.stop()
    if (this.options.cleanup) await del(this.options.repoPath)
  }

  async init() {
    const { repo, spec, netkey } = await config(this.options);
    const dataSpecPath = join(this.options.repoPath, 'datastore_spec')
    this.repo.init(repo, async error => {
      if (error) throw Error(error);
      await write(dataSpecPath, JSON.stringify(spec));
      if (netkey) {
        const netkeyPath = join(this.options.repoPath, 'swarm.key');
        await write(netkeyPath, normalizeNewline(netkey));
      }
      return;
    });
  }

  prepareRepo() {
    return new Promise((resolve, reject) => {
      this.repo.exists(async (error, exists) => {
        if (error) reject(error);
        else if (exists) resolve();
        else await this.init();
        resolve();
      })
    });
  }
}

export default options => new Node(options);
