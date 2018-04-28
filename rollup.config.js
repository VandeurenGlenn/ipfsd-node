const readFileSync = require('fs').readFileSync;
const npmPackage = readFileSync('package.json', 'utf8');
const { version, name } = JSON.parse(npmPackage);
export default [
	// ES module version, for modern browsers
	{
		input: ['src/node.js'],
		output: {
			dir: 'dist/module',
			format: 'es',
			sourcemap: true,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};`,
			banner: `/* ${name} version ${version} */`
		},
		experimentalCodeSplitting: true,
		experimentalDynamicImport: true
	},

	// CommonJS version, for Node, Browserify & Webpack
	{
		input: ['src/node.js'],
		output: {
			dir: 'dist/commonjs',
			format: 'cjs',
			sourcemap: true,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};`,
			banner: `/* ${name} version ${version} */`
		},
		experimentalCodeSplitting: true,
		experimentalDynamicImport: true
	}
];
