const fs = require('fs');
const path = require('path');
try {
	const cfg = require(path.join(__dirname, '..', 'jest.config.cjs'));
	fs.writeFileSync(path.join(__dirname, '..', 'jest_config_resolved.json'), JSON.stringify(cfg, null, 2));
	console.log('wrote');
} catch (err) {
	fs.writeFileSync(path.join(__dirname, '..', 'jest_config_error.txt'), String(err));
	console.error('error', err && err.message);
	process.exit(1);
}
