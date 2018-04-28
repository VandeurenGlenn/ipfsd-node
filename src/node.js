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
import { merge } from 'lodash'

const { exists, write } = fs;
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



const initRepo = async (ipfsRepo, options) => {
  const { repo, spec } = await config(options);
  const dataSpecPath = join(options.repoPath, 'datastore_spec')
  ipfsRepo.init(repo, async error => {
    if (error) throw Error(error);
    await write(dataSpecPath, JSON.stringify(spec));
    return;
  });
}

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
        resolve(id, addresses)
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

const prepareRepo = (repo, options) => new Promise((resolve, reject) => {
  repo.exists(async (error, exists) => {
    if (error) reject(error);
    else if (exists) resolve();
    else await initRepo(repo, options);
    resolve();
  })
});

const stop = (ipfsd, repoPath) => {
  process.emit('SIGINT')
}

const startIpfsd = async (ipfsd, options) => {
  const ipfstStartTime = Date.now();
  try {
    
    const { id, addresses } = await start(ipfsd, options.flags);
    
    console.log(`Daemon startup time: ${(Date.now() - ipfstStartTime) / 1000}s`);
    return {ipfsd, id, addresses};
      
  } catch (error) {
    if (error.message.includes('cannot acquire lock') ||
        error.code === 'ECONNREFUSED') {      
      await cleanRepo(options.repoPath);
    }
    return startIpfsd(ipfsd, options);
    // errorHandler(error);
  }
}
const defaultOptions = {
  repoPath: join(process.cwd(), 'repo')
}

export default async (options = {}) => {
  options = merge(defaultOptions, options)
  const repo = new Repo(options.repoPath);
  await prepareRepo(repo, options);
  const ipfsd = await spawn({init: false, repoPath: options.repoPath, disposable: false});
  return {
    start: async flags => startIpfsd(ipfsd, options),
    stop: async () => {
      await ipfsd.stop()
      await del(options.repoPath)
    },
    init: options => initRepo(repo, options)
  }
}
