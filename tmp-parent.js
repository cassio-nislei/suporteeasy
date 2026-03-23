const { fork } = require('child_process');
const cp = fork('./tmp-child.js');
cp.on('message', (m) => console.log('FORK_MSG', m));
cp.on('error', (e) => { console.error('FORK_ERR', e); process.exit(1); });
cp.on('exit', (c) => { console.log('FORK_EXIT', c); process.exit(c ?? 0); });
