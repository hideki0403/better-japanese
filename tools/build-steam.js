const path = require('path')
const fs = require('fs-extra')
const rootDir = path.join(__dirname, '../')
const distDir = path.join(rootDir, './build/')
const assetsDir = path.join(rootDir, './src/steam/')
const srcDir = path.join(rootDir, './src/common/')

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir)

fs.copySync(srcDir, distDir)
fs.copySync(assetsDir, distDir)