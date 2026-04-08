import fs from 'node:fs/promises';
import path from 'node:path';

const configPath = path.resolve(process.cwd(), 'ios/App/App/capacitor.config.json');
const pluginClassName = 'LifePulsePlanSyncPlugin';

try {
  const rawConfig = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(rawConfig);
  const packageClassList = Array.isArray(config.packageClassList) ? config.packageClassList : [];

  if (!packageClassList.includes(pluginClassName)) {
    packageClassList.push(pluginClassName);
    config.packageClassList = packageClassList;
    await fs.writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`, 'utf8');
    console.log(`Patched ${path.relative(process.cwd(), configPath)} with ${pluginClassName}`);
  } else {
    console.log(`${pluginClassName} already registered in ${path.relative(process.cwd(), configPath)}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Skip patching iOS capacitor config: ${message}`);
}