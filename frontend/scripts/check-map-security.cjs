const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const tracked = git(['ls-files', '-z', '--', '.']).split('\0').filter(Boolean)
assert.ok(!tracked.some(file => /^\.env(?:\.|$)/.test(file) && file !== '.env.example'), 'A frontend env file is tracked')
for (const file of ['.env', '.env.local']) {
  if (fs.existsSync(path.join(root, file))) assert.ok(git(['check-ignore', file]).trim(), `${file} must be ignored`)
}
const files = []
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) visit(target)
    else if (/\.(tsx?|jsx?|json|css|html)$/.test(entry.name)) files.push(target)
  }
}
visit(path.join(root, 'src'))
files.push(path.join(root, 'package.json'), path.join(root, 'index.html'))
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const name = path.relative(root, file)
  assert.ok(!/AIza[0-9A-Za-z_-]{30,}/.test(source), `Hardcoded Maps key in ${name}`)
  assert.ok(!/maplibre-gl|maplibregl/.test(source), `MapLibre remains in ${name}`)
  assert.ok(!/import\.meta\.env\.(?:DATABASE_URL|VITE_\w*(?:SECRET|PASSWORD|PRIVATE_KEY))\b/.test(source), `Server secret referenced in ${name}`)
}
console.log(`PASS: ${files.length} frontend source/config files checked; no hardcoded Maps keys, server secret references or MapLibre runtime code; env files ignored and untracked.`)
