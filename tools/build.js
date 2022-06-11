const path = require('path')
const fs = require('fs-extra')
const rootDir = path.join(__dirname, '../')
const distDir = path.join(rootDir, './build/')
const srcDir = path.join(rootDir, './src/')

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir)

fs.copySync(srcDir, distDir)