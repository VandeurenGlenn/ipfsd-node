/* ipfsd-node version 0.1.0 */
'use strict';

const ENVIRONMENT = {version: '0.1.0', production: true};

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Repo = require('ipfs-repo');
var IPFSFactory = require('ipfsd-ctl');
var path = require('path');
var fs = require('fs');
var chalk = _interopDefault(require('chalk'));
var repoConfigs = require('repo-configs');
var fs$1 = require('crypto-io-fs');
var del = _interopDefault(require('del'));
var normalizeNewline = _interopDefault(require('normalize-newline'));
var lodash = require('lodash');

// ipfs modules

const { exists, write } = fs$1;
const factory = IPFSFactory.create({type: 'go'});

if (process.platform === 'win32') {
  const readLine = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readLine.on('SIGINT', () => {
    process.emit('SIGINT');
  });
}


const initRepo = async (ipfsRepo, options) => {
  const { repo, spec, netkey } = await repoConfigs.config(options);
  const dataSpecPath = path.join(options.repoPath, 'datastore_spec');
  ipfsRepo.init(repo, async error => {
    if (error) throw Error(error);
    await write(dataSpecPath, JSON.stringify(spec));
    if (netkey) {      
      const netkeyPath = path.join(options.repoPath, 'swarm.key');
      console.log(netkey);
      await write(netkeyPath, normalizeNewline(netkey));
    }
    return;
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
        addresses.forEach(address => console.log(chalk.cyan(address)));
        console.groupEnd();
        resolve({id, addresses});
      }).catch(error => reject(error));
    } else {
      return start(ipfsd, flags)
    }
    
  });
});

const cleanRepo = async repoPath => {
  console.log(`cleaning repo`);
  try {
    const arr = [
      path.join(repoPath, 'api'),
      path.join(repoPath, 'repo.lock')
    ];
    let count = 0;
    for (const path$$1 of arr) {
      count++;
      const fileExists = await exists(path$$1);
      if (fileExists) fs.unlinkSync(path$$1);
      if (count === arr.length) {        
        return;
      }
    }
  } catch (error) {
    throw Error(error)
  }
};

const prepareRepo = (repo, options) => new Promise((resolve, reject) => {
  repo.exists(async (error, exists) => {
    if (error) reject(error);
    else if (exists) resolve();
    else await initRepo(repo, options);
    resolve();
  });
});

const startIpfsd = async (ipfsd, options) => {
  const ipfstStartTime = Date.now();
  try {
    
    const { id, addresses } = await start(ipfsd, options.flags);
    
    console.log(`Daemon startup time: ${(Date.now() - ipfstStartTime) / 1000}s`);
    return { ipfsd, id, addresses };
      
  } catch (error) {
    if (error.message.includes('cannot acquire lock') ||
        error.code === 'ECONNREFUSED') {      
      await cleanRepo(options.repoPath);
    }
    return startIpfsd(ipfsd, options);
    // errorHandler(error);
  }
};
const defaultOptions = {
  repoPath: path.join(process.cwd(), 'repo')
};

var node = async (options = {}) => {
  options = lodash.merge(defaultOptions, options);
  const repo = new Repo(options.repoPath);
  await prepareRepo(repo, options);
  const ipfsd = await spawn({init: false, repoPath: options.repoPath, disposable: false});
  return {
    start: async flags => startIpfsd(ipfsd, options),
    stop: async () => {
      await ipfsd.stop();
      await del(options.repoPath);
    },
    init: options => initRepo(repo, options)
  }
}

module.exports = node;
//# sourceMappingURL=node.js.map
